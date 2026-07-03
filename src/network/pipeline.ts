import type { CookieJar } from "./cookie-jar";
import { executeHttp } from "./http-driver";
import {
  bearerHeaderValue,
  buildClientCredentialsRequest,
  parseTokenResponse,
} from "./auth/oauth2";
import {
  computeDigestHeader,
  generateCnonce,
  parseChallenge,
} from "./auth/digest";
import { applyStaticAuth } from "./auth/static-auth";
import { signAwsV4 } from "./auth/aws-v4";
import { serializeBody } from "./body";
import { runScript, type ScriptResponseView } from "./script-runner";
import type {
  AuthConfig,
  DriverEvent,
  ExecuteJob,
  HttpRequest,
  HttpRequestSpec,
  KeyValueItem,
  RequestSettings,
  ScriptMutation,
  StreamEvent,
} from "./request-channels";
import { mergeQueryParams } from "./url-params";
import { flattenScopes, resolveTemplate } from "./variables";

/**
 * 对一组键值项的 value 做变量解析.
 * @param items 键值项.
 * @param vars 扁平变量表.
 * @returns 解析后的键值项.
 */
function resolveItems(
  items: readonly KeyValueItem[],
  vars: Readonly<Record<string, string>>,
): KeyValueItem[] {
  return items.map((item) => ({
    ...item,
    value: resolveTemplate(item.value, vars),
  }));
}

/**
 * 对鉴权配置中的字符串字段做变量解析.
 * @param auth 鉴权配置.
 * @param vars 扁平变量表.
 * @returns 解析后的鉴权配置.
 */
function resolveAuth(
  auth: AuthConfig,
  vars: Readonly<Record<string, string>>,
): AuthConfig {
  const r = (value: string): string => resolveTemplate(value, vars);
  switch (auth.type) {
    case "basic":
      return {
        ...auth,
        username: r(auth.username),
        password: r(auth.password),
      };
    case "bearer":
      return { ...auth, token: r(auth.token) };
    case "apikey":
      return { ...auth, key: r(auth.key), value: r(auth.value) };
    case "digest":
      return {
        ...auth,
        username: r(auth.username),
        password: r(auth.password),
      };
    case "oauth2":
      return {
        ...auth,
        accessToken: r(auth.accessToken),
        tokenUrl: r(auth.tokenUrl),
        clientId: r(auth.clientId),
        clientSecret: r(auth.clientSecret),
        scope: r(auth.scope),
      };
    case "awsv4":
      return {
        ...auth,
        accessKeyId: r(auth.accessKeyId),
        secretAccessKey: r(auth.secretAccessKey),
        region: r(auth.region),
        service: r(auth.service),
        sessionToken: r(auth.sessionToken),
      };
    default:
      return auth;
  }
}

/**
 * 对请求体配置中的字符串字段做变量解析.
 * @param body 请求体配置.
 * @param vars 扁平变量表.
 * @returns 解析后的请求体配置.
 */
function resolveBody(
  body: HttpRequest["body"],
  vars: Readonly<Record<string, string>>,
): HttpRequest["body"] {
  switch (body.type) {
    case "raw":
      return { ...body, text: resolveTemplate(body.text, vars) };
    case "graphql":
      return {
        ...body,
        query: resolveTemplate(body.query, vars),
        variables: resolveTemplate(body.variables, vars),
      };
    case "urlencoded":
      return { ...body, items: resolveItems(body.items, vars) };
    case "formdata":
      return {
        ...body,
        items: body.items.map((item) => ({
          ...item,
          value: resolveTemplate(item.value, vars),
          filename:
            item.filename !== undefined
              ? resolveTemplate(item.filename, vars)
              : undefined,
        })),
      };
    default:
      return body;
  }
}

/**
 * 把高层请求按变量表整体解析 (url/params/headers/auth/body).
 * @param request 高层请求.
 * @param vars 扁平变量表.
 * @returns 解析后的高层请求.
 */
function resolveRequest(
  request: HttpRequest,
  vars: Readonly<Record<string, string>>,
): HttpRequest {
  return {
    ...request,
    url: resolveTemplate(request.url, vars),
    params: resolveItems(request.params, vars),
    headers: resolveItems(request.headers, vars),
    auth: resolveAuth(request.auth, vars),
    body: resolveBody(request.body, vars),
  };
}

/**
 * 缓冲式发送一个驱动层请求, 聚合状态/头/体 (供 digest 预检与 oauth2 取令牌).
 * @param spec 驱动层请求.
 * @param jar Cookie Jar.
 * @param signal 取消信号.
 * @returns 状态码, 响应头, 完整响应体.
 */
export async function collectResponse(
  spec: HttpRequestSpec,
  jar: CookieJar,
  signal: AbortSignal,
): Promise<{
  readonly status: number;
  readonly headers: Record<string, string | string[]>;
  readonly body: Buffer;
}> {
  let status = 0;
  let headers: Record<string, string | string[]> = {};
  const chunks: Buffer[] = [];
  await executeHttp(
    spec,
    jar,
    (event: DriverEvent) => {
      if (event.kind === "status") {
        status = (event.payload as { statusCode: number }).statusCode;
      } else if (event.kind === "headers") {
        headers = event.payload as Record<string, string | string[]>;
      } else if (event.kind === "chunk") {
        chunks.push(
          Buffer.from((event.payload as { base64: string }).base64, "base64"),
        );
      }
    },
    signal,
  );
  return { status, headers, body: Buffer.concat(chunks) };
}

/**
 * 取响应头的单值 (数组取首个).
 * @param value 头值.
 * @returns 单值字符串.
 */
function singleHeader(value: string | string[] | undefined): string {
  if (value === undefined) {
    return "";
  }
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

/**
 * 当前 UTC 时间的 AWS amzDate (yyyymmddThhmmssZ).
 * @returns amzDate 串.
 */
function currentAmzDate(): string {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * 把高层请求转为驱动层 spec: 合并参数 -> 应用鉴权/Body.
 * digest/oauth2 需要网络的部分在这里完成 (借助 collectResponse).
 * @param request 已变量解析的高层请求.
 * @param jar Cookie Jar.
 * @param signal 取消信号.
 * @returns 驱动层请求.
 */
async function applyAuthAndBody(
  request: HttpRequest,
  jar: CookieJar,
  signal: AbortSignal,
): Promise<HttpRequestSpec> {
  const headers: KeyValueItem[] = [...request.headers];
  let params: KeyValueItem[] = [...request.params];

  // 静态鉴权 (basic/bearer/apikey).
  const stat = applyStaticAuth(request.auth);
  headers.push(...stat.headers);
  params = [...params, ...stat.queryParams];

  // 请求体序列化.
  const serialized = await serializeBody(request.body);
  if (
    serialized.contentType !== undefined &&
    !headers.some((h) => h.key.toLowerCase() === "content-type")
  ) {
    headers.push({
      id: "auto-content-type",
      key: "Content-Type",
      value: serialized.contentType,
      enabled: true,
    });
  }

  // 合并查询参数到 URL.
  const url = mergeQueryParams(request.url, params);

  // AWS SigV4 (需 body 字节).
  if (request.auth.type === "awsv4") {
    const signed = signAwsV4({
      method: request.method,
      url,
      body: serialized.body ?? Buffer.alloc(0),
      auth: request.auth,
      amzDate: currentAmzDate(),
    });
    headers.push(...signed.headers);
  }

  // OAuth2 client_credentials: 先取令牌.
  if (request.auth.type === "oauth2") {
    const token =
      request.auth.grant === "client_credentials"
        ? await fetchOAuth2Token(request.auth, request.settings, jar, signal)
        : request.auth.accessToken;
    headers.push({
      id: "auth-oauth2",
      key: "Authorization",
      value: bearerHeaderValue(token, request.auth.headerPrefix),
      enabled: true,
    });
  }

  // Digest: 先探 401 拿挑战 (预检带已组装头与 body, 镜像真实请求).
  if (request.auth.type === "digest") {
    const authValue = await resolveDigest(
      request,
      url,
      headers,
      serialized.body,
      jar,
      signal,
    );
    if (authValue !== undefined) {
      headers.push({
        id: "auth-digest",
        key: "Authorization",
        value: authValue,
        enabled: true,
      });
    }
  }

  return {
    method: request.method,
    url,
    headers,
    body: serialized.body,
    cleanMode: request.cleanMode,
    settings: request.settings,
  };
}

/**
 * 取 OAuth2 client_credentials 访问令牌.
 *
 * TLS 相关设置 (sslVerify/customCaPath/clientCert/tlsMinVersion/tlsMaxVersion/sni) 继承自
 * 业务请求的 settings, 确保自建 IdP 场景下证书配置一致.
 * @param auth oauth2 鉴权配置.
 * @param requestSettings 业务请求的设置 (TLS 字段从此继承).
 * @param jar Cookie Jar.
 * @param signal 取消信号.
 * @returns access_token.
 */
async function fetchOAuth2Token(
  auth: Extract<AuthConfig, { type: "oauth2" }>,
  requestSettings: RequestSettings,
  jar: CookieJar,
  signal: AbortSignal,
): Promise<string> {
  const tokenReq = buildClientCredentialsRequest(auth);
  const response = await collectResponse(
    {
      method: "POST",
      url: tokenReq.url,
      headers: [
        {
          id: "ct",
          key: "Content-Type",
          value: tokenReq.contentType,
          enabled: true,
        },
      ],
      body: tokenReq.body,
      cleanMode: false,
      settings: {
        followRedirects: true,
        maxRedirects: 5,
        timeoutMs: 30000,
        sslVerify: requestSettings.sslVerify,
        customCaPath: requestSettings.customCaPath,
        clientCert: requestSettings.clientCert,
        tlsMinVersion: requestSettings.tlsMinVersion,
        tlsMaxVersion: requestSettings.tlsMaxVersion,
        sni: requestSettings.sni,
      },
    },
    jar,
    signal,
  );
  if (response.status === 0) {
    throw new Error("OAuth2 令牌请求失败: 无响应或网络错误");
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`OAuth2 令牌端点返回 ${response.status}`);
  }
  return parseTokenResponse(response.body.toString("utf8"));
}

/**
 * 对 Digest 鉴权做 401 预检并计算 Authorization 头值.
 *
 * 预检请求镜像真实请求: 使用已组装的 headers (含自动 content-type, 不含 digest Authorization)
 * 与序列化后的 body, 确保 POST+digest 场景下服务器能正确返回 401 挑战而非 400.
 * @param request 高层请求.
 * @param url 已合并参数的 URL.
 * @param headers 已组装的请求头 (含静态鉴权头与自动 content-type, 不含 digest Authorization).
 * @param body 序列化后的请求体.
 * @param jar Cookie Jar.
 * @param signal 取消信号.
 * @returns Authorization 头值; 未拿到 Digest 挑战时为 undefined.
 */
async function resolveDigest(
  request: HttpRequest,
  url: string,
  headers: readonly KeyValueItem[],
  body: Buffer | undefined,
  jar: CookieJar,
  signal: AbortSignal,
): Promise<string | undefined> {
  if (request.auth.type !== "digest") {
    return undefined;
  }
  const probe = await collectResponse(
    {
      method: request.method,
      url,
      headers: [...headers],
      body,
      cleanMode: request.cleanMode,
      settings: request.settings,
    },
    jar,
    signal,
  );
  const challenge = parseChallenge(
    singleHeader(probe.headers["www-authenticate"]),
  );
  if (challenge === undefined) {
    return undefined;
  }
  const parsedUrl = new URL(url);
  return computeDigestHeader({
    username: request.auth.username,
    password: request.auth.password,
    method: request.method,
    uri: parsedUrl.pathname + parsedUrl.search,
    challenge,
    cnonce: generateCnonce(),
    nc: "00000001",
  });
}

/**
 * 执行一个作业: 前置脚本 -> 变量解析 -> 鉴权/Body/参数 -> 发送 (累积响应) -> 后置脚本 -> end.
 * 脚本对变量的改动经 vars 事件回传; 断言/日志经 test/log 事件回传.
 * @param job 执行作业.
 * @param jar Cookie Jar.
 * @param onEvent 流式事件回调 (带 jobId).
 * @param signal 取消信号.
 */
export async function runJob(
  job: ExecuteJob,
  jar: CookieJar,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const emit = (event: DriverEvent): void =>
    onEvent({ ...event, jobId: job.jobId });

  // 可变作用域副本: 前置脚本可改, 影响后续解析.
  const scopes = {
    global: { ...job.variableScopes.global },
    collection: { ...job.variableScopes.collection },
    environment: { ...job.variableScopes.environment },
    local: { ...job.variableScopes.local },
  };

  const requestView = {
    method: job.spec.method,
    url: job.spec.url,
    headers: job.spec.headers
      .filter((h) => h.enabled)
      .map((h) => ({ key: h.key, value: h.value })),
  };

  // 前置脚本.
  if (job.spec.preScript.trim() !== "") {
    const outcome = runScript(job.spec.preScript, {
      request: requestView,
      scopes,
    });
    applyMutationsToScopes(scopes, outcome.mutations);
    emitScriptOutcome(emit, outcome);
    if (outcome.error !== "") {
      // 前置脚本出错则不发送请求, 以 error 终态呈现 (而非误导性的成功 end).
      emit({
        kind: "error",
        payload: { message: `前置脚本错误: ${outcome.error}` },
      });
      return;
    }
  }

  let spec: HttpRequestSpec;
  try {
    spec = await applyAuthAndBody(
      resolveRequest(job.spec, flattenScopes(scopes)),
      jar,
      signal,
    );
  } catch (err) {
    emit({
      kind: "error",
      payload: { message: err instanceof Error ? err.message : String(err) },
    });
    return;
  }

  // 发送; 累积响应体供后置脚本.
  const chunks: Buffer[] = [];
  let status = 0;
  let statusText = "";
  let responseHeaders: Record<string, string | string[]> = {};
  let timeMs = 0;
  let failed = false;
  let errorMessage = "";

  await executeHttp(
    spec,
    jar,
    (event: DriverEvent) => {
      // 终态 (end/error) 不透传: 留到后置脚本之后再发, 且保留原始错误信息.
      if (event.kind === "end") {
        return;
      }
      if (event.kind === "error") {
        failed = true;
        errorMessage = (event.payload as { message: string }).message;
        return;
      }
      if (event.kind === "status") {
        const p = event.payload as { statusCode: number; statusText: string };
        status = p.statusCode;
        statusText = p.statusText;
      } else if (event.kind === "headers") {
        responseHeaders = event.payload as Record<string, string | string[]>;
      } else if (event.kind === "chunk") {
        chunks.push(
          Buffer.from((event.payload as { base64: string }).base64, "base64"),
        );
      } else if (event.kind === "metric") {
        timeMs = (event.payload as { totalMs: number }).totalMs;
      }
      // 透传非终态事件 (status/headers/chunk/metric).
      emit(event);
    },
    signal,
  );

  // 后置脚本 (失败也跑, 让脚本能断言失败).
  if (job.spec.postScript.trim() !== "") {
    const response: ScriptResponseView = {
      code: status,
      status: statusText,
      responseTime: timeMs,
      headers: responseHeaders,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    const outcome = runScript(job.spec.postScript, {
      request: requestView,
      response,
      scopes,
    });
    emitScriptOutcome(emit, outcome);
  }

  emit({
    kind: failed ? "error" : "end",
    payload: failed ? { message: errorMessage } : { ok: true },
  });
}

/**
 * 把脚本变量改动应用到作用域副本 (供后续解析).
 * @param scopes 可变作用域副本.
 * @param mutations 脚本改动.
 */
function applyMutationsToScopes(
  scopes: {
    global: Record<string, string>;
    collection: Record<string, string>;
    environment: Record<string, string>;
    local: Record<string, string>;
  },
  mutations: readonly ScriptMutation[],
): void {
  const slot = {
    globals: scopes.global,
    collection: scopes.collection,
    environment: scopes.environment,
    local: scopes.local,
  } as const;
  for (const m of mutations) {
    if (m.action === "set") {
      slot[m.scope][m.key] = m.value;
    } else {
      delete slot[m.scope][m.key];
    }
  }
}

/**
 * 把脚本产出 (变量改动/断言/日志) 转为流式事件发出.
 * @param emit 事件发射器.
 * @param outcome 脚本产出.
 */
function emitScriptOutcome(
  emit: (event: DriverEvent) => void,
  outcome: {
    mutations: readonly ScriptMutation[];
    tests: readonly { name: string; passed: boolean; error: string }[];
    logs: readonly string[];
    error: string;
  },
): void {
  if (outcome.mutations.length > 0) {
    emit({ kind: "vars", payload: { mutations: outcome.mutations } });
  }
  for (const log of outcome.logs) {
    emit({ kind: "log", payload: { message: log } });
  }
  for (const test of outcome.tests) {
    emit({ kind: "test", payload: test });
  }
  if (outcome.error !== "") {
    emit({ kind: "log", payload: { message: `脚本错误: ${outcome.error}` } });
  }
}
