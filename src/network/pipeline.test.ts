// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CookieJar } from "./cookie-jar";
import { runJob } from "./pipeline";
import type {
  AuthConfig,
  BodyConfig,
  ExecuteJob,
  HttpRequest,
  StreamEvent,
} from "./request-channels";

let server: Server;
let port: number;
const seen: {
  path: string;
  method: string;
  auth: string;
  contentType: string;
  body: string;
} = { path: "", method: "", auth: "", contentType: "", body: "" };

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.path = req.url ?? "";
      seen.method = req.method ?? "";
      seen.auth = req.headers["authorization"] ?? "";
      seen.contentType = req.headers["content-type"] ?? "";
      seen.body = body;
      if ((req.url ?? "").split("?")[0] === "/digest") {
        if (!req.headers["authorization"]) {
          res.writeHead(401, {
            "www-authenticate":
              'Digest realm="r@h", qop="auth", nonce="abc123nonce"',
          });
          res.end();
          return;
        }
        res.writeHead(200);
        res.end("DIGEST-OK");
        return;
      }
      if (req.url === "/token") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"access_token":"TOK123","token_type":"Bearer"}');
        return;
      }
      res.writeHead(200);
      res.end("OK");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

const settings = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 10000,
  sslVerify: true,
};

const baseRequest = (over: Partial<HttpRequest>): HttpRequest => ({
  method: "GET",
  url: `http://127.0.0.1:${port}/`,
  params: [],
  headers: [],
  cleanMode: false,
  auth: { type: "none" },
  body: { type: "none" },
  settings,
  preScript: "",
  postScript: "",
  ...over,
});

const noScopes = { global: {}, collection: {}, environment: {}, local: {} };

async function run(request: HttpRequest): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  const job: ExecuteJob = {
    jobId: "j",
    spec: request,
    variableScopes: noScopes,
  };
  await runJob(
    job,
    new CookieJar(),
    (e) => events.push(e),
    new AbortController().signal,
  );
  return events;
}

describe("runJob 鉴权与请求体", () => {
  it("basic 鉴权附加 Authorization 头", async () => {
    await run(
      baseRequest({
        auth: { type: "basic", username: "u", password: "p" } as AuthConfig,
      }),
    );
    expect(seen.auth).toBe("Basic dTpw");
  });

  it("apikey 加到 query", async () => {
    await run(
      baseRequest({
        url: `http://127.0.0.1:${port}/x`,
        auth: {
          type: "apikey",
          key: "api_key",
          value: "K",
          addTo: "query",
        } as AuthConfig,
      }),
    );
    expect(seen.path).toBe("/x?api_key=K");
  });

  it("urlencoded 体设置 content-type 并被服务端收到", async () => {
    const body: BodyConfig = {
      type: "urlencoded",
      items: [{ id: "1", key: "a", value: "b", enabled: true }],
    };
    await run(baseRequest({ method: "POST", body }));
    expect(seen.contentType).toBe("application/x-www-form-urlencoded");
    expect(seen.body).toBe("a=b");
  });

  it("formdata 体设置 multipart content-type", async () => {
    const body: BodyConfig = {
      type: "formdata",
      items: [{ id: "1", key: "f", value: "v", enabled: true, kind: "text" }],
    };
    await run(baseRequest({ method: "POST", body }));
    expect(seen.contentType.startsWith("multipart/form-data; boundary=")).toBe(
      true,
    );
    expect(seen.body).toContain('name="f"');
  });

  it("awsv4 附加 AWS4-HMAC-SHA256 的 Authorization", async () => {
    await run(
      baseRequest({
        auth: {
          type: "awsv4",
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
          region: "us-east-1",
          service: "svc",
          sessionToken: "",
        } as AuthConfig,
      }),
    );
    expect(seen.auth.startsWith("AWS4-HMAC-SHA256 Credential=AKID/")).toBe(
      true,
    );
  });

  it("digest 鉴权先探 401 再带 Authorization 重发成功", async () => {
    const events = await run(
      baseRequest({
        url: `http://127.0.0.1:${port}/digest`,
        auth: {
          type: "digest",
          username: "Mufasa",
          password: "pw",
        } as AuthConfig,
      }),
    );
    expect(seen.auth.startsWith("Digest ")).toBe(true);
    expect(seen.auth).toMatch(/username="Mufasa"/);
    expect(seen.auth).toMatch(/realm="r@h"/);
    expect(seen.auth).toMatch(/response="[0-9a-f]{32}"/);
    const status = events.find((e) => e.kind === "status")?.payload as {
      statusCode: number;
    };
    expect(status.statusCode).toBe(200);
  });

  it("digest 带 query 参数时 digest-uri 包含 query string", async () => {
    const events = await run(
      baseRequest({
        url: `http://127.0.0.1:${port}/digest`,
        params: [{ id: "1", key: "foo", value: "bar", enabled: true }],
        auth: {
          type: "digest",
          username: "Mufasa",
          password: "pw",
        } as AuthConfig,
      }),
    );
    expect(seen.auth).toMatch(/uri="\/digest\?foo=bar"/);
    const status = events.find((e) => e.kind === "status")?.payload as {
      statusCode: number;
    };
    expect(status.statusCode).toBe(200);
  });

  it("oauth2 client_credentials 先取令牌再带 Bearer", async () => {
    await run(
      baseRequest({
        url: `http://127.0.0.1:${port}/api`,
        auth: {
          type: "oauth2",
          grant: "client_credentials",
          accessToken: "",
          tokenUrl: `http://127.0.0.1:${port}/token`,
          clientId: "c",
          clientSecret: "s",
          scope: "",
          headerPrefix: "Bearer",
        } as AuthConfig,
      }),
    );
    expect(seen.auth).toBe("Bearer TOK123");
  });

  it("解析 url/header 的 {{var}} 并给事件补 jobId", async () => {
    const events: StreamEvent[] = [];
    const job: ExecuteJob = {
      jobId: "job-1",
      spec: baseRequest({
        url: `http://127.0.0.1:${port}/{{p}}`,
        headers: [{ id: "1", key: "X-T", value: "{{t}}", enabled: true }],
      }),
      variableScopes: {
        global: {},
        collection: {},
        environment: { p: "v1", t: "T" },
        local: {},
      },
    };
    await runJob(
      job,
      new CookieJar(),
      (e) => events.push(e),
      new AbortController().signal,
    );
    expect(seen.path).toBe("/v1");
    expect(events.every((e) => e.jobId === "job-1")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 用例 (11): 前置脚本出错 -> error 终态且不发送请求
// ---------------------------------------------------------------------------
describe("前置脚本错误", () => {
  let countServer: Server;
  let countPort: number;
  let requestCount = 0;

  beforeAll(async () => {
    countServer = createServer((_req, res) => {
      requestCount++;
      res.writeHead(200);
      res.end("OK");
    });
    await new Promise<void>((resolve) =>
      countServer.listen(0, "127.0.0.1", resolve),
    );
    countPort = (countServer.address() as AddressInfo).port;
  });

  afterAll(() => countServer.close());

  it("前置脚本抛错后以 error 终态结束, 不向服务端发送请求", async () => {
    requestCount = 0;

    const events = await run(
      baseRequest({
        url: `http://127.0.0.1:${countPort}/`,
        preScript: "throw new Error('前置失败');",
      }),
    );

    // 应以 error 终态结束
    const lastEvent = events.at(-1);
    expect(lastEvent?.kind).toBe("error");
    // 消息应含脚本错误提示
    const msg = (lastEvent?.payload as { message: string }).message;
    expect(msg).toMatch(/前置脚本错误/);
    // 服务端收到请求数应为 0
    expect(requestCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 用例 (12): oauth2 令牌端点返回非 2xx -> 抛错并以 error 终态
// ---------------------------------------------------------------------------
describe("oauth2 令牌端点错误", () => {
  let tokenErrorServer: Server;
  let tokenErrorPort: number;

  beforeAll(async () => {
    tokenErrorServer = createServer((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end('{"error":"invalid_client"}');
    });
    await new Promise<void>((resolve) =>
      tokenErrorServer.listen(0, "127.0.0.1", resolve),
    );
    tokenErrorPort = (tokenErrorServer.address() as AddressInfo).port;
  });

  afterAll(() => tokenErrorServer.close());

  it("令牌端点返回 401 时以 error 终态结束", async () => {
    const events = await run(
      baseRequest({
        auth: {
          type: "oauth2",
          grant: "client_credentials",
          accessToken: "",
          tokenUrl: `http://127.0.0.1:${tokenErrorPort}/token`,
          clientId: "c",
          clientSecret: "s",
          scope: "",
          headerPrefix: "Bearer",
        } as AuthConfig,
      }),
    );

    const lastEvent = events.at(-1);
    expect(lastEvent?.kind).toBe("error");
    const msg = (lastEvent?.payload as { message: string }).message;
    expect(msg).toMatch(/401/);
  });
});
