import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";

import type { CookieJar } from "./cookie-jar";
import type {
  DriverEvent,
  HttpRequestSpec,
  KeyValueItem,
} from "./request-channels";
import { buildTlsOptions } from "./tls-options";

/**
 * 非洁净模式下补充的默认头 (键名小写; 用户头优先, 不覆盖).
 */
const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  "user-agent": "radish-tool-box",
  accept: "*/*",
  "accept-encoding": "gzip, deflate, br",
  connection: "keep-alive",
};

/**
 * 跨域重定向时需从转发头中剥离的敏感头 (小写键).
 */
const SENSITIVE_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
]);

/**
 * 把启用的键值头组装为请求头对象 (小写键), 应用洁净模式与跨域剥离策略.
 * @param items 用户头.
 * @param cleanMode 洁净模式开关.
 * @param cookieHeader Cookie Jar 计算出的 Cookie 头 (空串表示无).
 * @param stripSensitive 跨域重定向后是否剥离用户设置的鉴权/Cookie 头.
 * @returns 请求头对象.
 */
function assembleHeaders(
  items: readonly KeyValueItem[],
  cleanMode: boolean,
  cookieHeader: string,
  stripSensitive: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!cleanMode) {
    for (const [key, value] of Object.entries(DEFAULT_HEADERS)) {
      headers[key] = value;
    }
  }
  for (const item of items) {
    if (item.enabled && item.key !== "") {
      const key = item.key.toLowerCase();
      // 跨域跳转剥离用户手动设置的鉴权/Cookie, 避免凭据泄漏到新源.
      if (stripSensitive && SENSITIVE_HEADERS.has(key)) {
        continue;
      }
      headers[key] = item.value;
    }
  }
  // Cookie Jar 按目标源逐跳重算, 不受 stripSensitive 影响 (本就是该源的合法 Cookie).
  if (cookieHeader !== "" && headers["cookie"] === undefined) {
    headers["cookie"] = cookieHeader;
  }
  return headers;
}

/**
 * 归一响应头为字符串/字符串数组映射.
 * @param message 响应消息.
 * @returns 响应头映射.
 */
function normalizeResponseHeaders(
  message: IncomingMessage,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(message.headers)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * 按 content-encoding 选择解压流; 无需解压返回原响应流.
 * @param response 响应消息.
 * @returns 可读取明文的流.
 */
function decodeStream(response: IncomingMessage): Readable {
  const encoding = (response.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip") {
    return response.pipe(createGunzip());
  }
  if (encoding === "deflate") {
    return response.pipe(createInflate());
  }
  if (encoding === "br") {
    return response.pipe(createBrotliDecompress());
  }
  return response;
}

/**
 * 执行一次 HTTP/HTTPS 请求 (含洁净模式/重定向/解压), 以回调发出流式事件.
 * @param spec 请求规格.
 * @param jar Cookie Jar.
 * @param onEvent 事件回调.
 * @param signal 取消信号.
 */
export async function executeHttp(
  spec: HttpRequestSpec,
  jar: CookieJar,
  onEvent: (event: DriverEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const startedAt = performance.now();
  // 兜底首跳的同步/异步抛出 (非法 URL, TLS 文件读取失败等), 归一为 error 事件不外抛.
  try {
    await sendOnce(
      spec,
      spec.url,
      spec.method,
      spec.body,
      false,
      0,
      jar,
      onEvent,
      signal,
      startedAt,
    );
  } catch (err) {
    onEvent({
      kind: "error",
      payload: { message: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * 发送单跳请求; 命中可跟随的重定向时递归下一跳.
 * @param spec 原始请求规格 (头/洁净模式/设置).
 * @param currentUrl 当前跳的 URL.
 * @param method 当前跳的有效方法 (重定向可能降级为 GET).
 * @param body 当前跳的有效请求体 (降级为 GET 时为 undefined).
 * @param stripSensitive 是否剥离用户鉴权/Cookie 头 (跨域跳转后置位).
 * @param redirectCount 已重定向次数.
 * @param jar Cookie Jar.
 * @param onEvent 事件回调.
 * @param signal 取消信号.
 * @param startedAt 计时起点 (performance.now).
 */
async function sendOnce(
  spec: HttpRequestSpec,
  currentUrl: string,
  method: string,
  body: string | Buffer | undefined,
  stripSensitive: boolean,
  redirectCount: number,
  jar: CookieJar,
  onEvent: (event: DriverEvent) => void,
  signal: AbortSignal,
  startedAt: number,
): Promise<void> {
  const url = new URL(currentUrl);
  const isHttps = url.protocol === "https:";
  const tls = isHttps ? await buildTlsOptions(spec.settings) : {};
  const headers = assembleHeaders(
    spec.headers,
    spec.cleanMode,
    jar.headerFor(currentUrl),
    stripSensitive,
  );
  // 显式设置 Content-Length, 避免带体请求一律走 chunked (部分服务端/签名校验对此敏感).
  const hasBody = body !== undefined && body !== "";
  if (
    body !== undefined &&
    body !== "" &&
    headers["content-length"] === undefined
  ) {
    headers["content-length"] = String(Buffer.byteLength(body));
  }

  await new Promise<void>((resolve) => {
    const requestFn = isHttps ? httpsRequest : httpRequest;
    const clientRequest = requestFn(
      url,
      { method, headers, signal, ...tls },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers["location"];
        const setCookie = response.headers["set-cookie"];
        if (setCookie) {
          jar.setFromHeaders(currentUrl, setCookie);
          // 每跳的 Set-Cookie 都上报, 使响应区能显示重定向链上设置的 cookie.
          onEvent({ kind: "cookie", payload: { setCookie } });
        }
        if (
          spec.settings.followRedirects &&
          status >= 300 &&
          status < 400 &&
          typeof location === "string" &&
          redirectCount < spec.settings.maxRedirects
        ) {
          response.resume();
          // 下一跳的 URL 解析或 TLS 初始化可能抛出; rejection 也必须让外层 Promise 落定, 否则永挂.
          void (async (): Promise<void> => {
            try {
              const nextUrlObj = new URL(location, url);
              const nextUrl = nextUrlObj.toString();
              // 303 一律改 GET 去体; 301/302 对非 GET/HEAD 降级为 GET (curl/浏览器惯例); 307/308 保留.
              const downgrade =
                status === 303 ||
                ((status === 301 || status === 302) &&
                  method !== "GET" &&
                  method !== "HEAD");
              const nextMethod = downgrade ? "GET" : method;
              const nextBody = downgrade ? undefined : body;
              // 跨源 (协议/主机/端口任一不同) 跳转后剥离敏感头, 且一旦剥离保持剥离.
              const nextStrip =
                stripSensitive || nextUrlObj.origin !== url.origin;
              await sendOnce(
                spec,
                nextUrl,
                nextMethod,
                nextBody,
                nextStrip,
                redirectCount + 1,
                jar,
                onEvent,
                signal,
                startedAt,
              );
            } catch (err) {
              onEvent({
                kind: "error",
                payload: {
                  message: err instanceof Error ? err.message : String(err),
                },
              });
            } finally {
              resolve();
            }
          })();
          return;
        }
        // 到达最终响应 (非重定向跳): 上报本跳实际带出的 Cookie 头, 使分页显示"发送的 cookie".
        if (headers["cookie"] !== undefined) {
          onEvent({ kind: "cookie", payload: { sent: headers["cookie"] } });
        }
        onEvent({
          kind: "status",
          payload: {
            statusCode: status,
            statusText: response.statusMessage ?? "",
            httpVersion: response.httpVersion,
          },
        });
        onEvent({
          kind: "headers",
          payload: normalizeResponseHeaders(response),
        });
        const stream = decodeStream(response);
        stream.on("data", (chunk: Buffer) => {
          onEvent({
            kind: "chunk",
            payload: { base64: chunk.toString("base64") },
          });
        });
        stream.on("end", () => {
          onEvent({
            kind: "metric",
            payload: { totalMs: Math.round(performance.now() - startedAt) },
          });
          onEvent({ kind: "end", payload: { ok: true } });
          resolve();
        });
        stream.on("error", (err: Error) => {
          // 用户取消 (signal.aborted) 不作为错误; 由渲染层的 "已取消" 态呈现.
          if (!signal.aborted) {
            onEvent({ kind: "error", payload: { message: err.message } });
          }
          resolve();
        });
      },
    );
    clientRequest.setTimeout(spec.settings.timeoutMs, () => {
      clientRequest.destroy(new Error("请求超时"));
    });
    clientRequest.on("error", (err: NodeJS.ErrnoException) => {
      // 用户取消 (signal.aborted) 不作为错误; 由渲染层的 "已取消" 态呈现.
      if (!signal.aborted) {
        onEvent({
          kind: "error",
          payload: { message: err.message, code: err.code },
        });
      }
      resolve();
    });
    if (hasBody && body !== undefined) {
      clientRequest.write(body);
    }
    clientRequest.end();
  });
}
