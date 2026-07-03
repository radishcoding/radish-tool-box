// @vitest-environment node
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CookieJar } from "./cookie-jar";
import { executeHttp } from "./http-driver";
import type { DriverEvent, HttpRequestSpec } from "./request-channels";

// ---------------------------------------------------------------------------
// 共享工具
// ---------------------------------------------------------------------------

/** 从事件列表中读取响应体. */
function bodyOf(events: DriverEvent[]): string {
  return events
    .filter((e) => e.kind === "chunk")
    .map((e) => Buffer.from((e.payload as { base64: string }).base64, "base64"))
    .reduce((acc, b) => Buffer.concat([acc, b]), Buffer.alloc(0))
    .toString();
}

/** 读取服务端回显的请求头 (服务端将其 JSON 序列化后返回). */
function echoedHeaders(events: DriverEvent[]): Record<string, string> {
  return JSON.parse(bodyOf(events)) as Record<string, string>;
}

const DEFAULT_SETTINGS: HttpRequestSpec["settings"] = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 10000,
  sslVerify: true,
};

/** 构造请求 spec 并运行, 返回事件列表. */
async function runSpec(spec: HttpRequestSpec): Promise<DriverEvent[]> {
  const events: DriverEvent[] = [];
  await executeHttp(
    spec,
    new CookieJar(),
    (e) => events.push(e),
    new AbortController().signal,
  );
  return events;
}

/** 把 IncomingMessage 的头转为 Record<string, string>. */
function flattenHeaders(
  headers: IncomingMessage["headers"],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(", ") : (v ?? ""),
    ]),
  );
}

/** 启动一个监听在随机端口 127.0.0.1 的 HTTP 服务器. */
async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: Server; port: number }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, port };
}

// ---------------------------------------------------------------------------
// 服务器 A: 主功能服务器 (持久, 仅存在于 beforeAll/afterAll 生命周期内)
// ---------------------------------------------------------------------------
let serverA: Server;
let portA: number;

/** 服务器 A 最近一次收到的请求元数据. */
const capturedA: {
  headers: Record<string, string>;
  method: string;
  body: string;
} = { headers: {}, method: "", body: "" };

beforeAll(async () => {
  const result = await startServer((req: IncomingMessage, res) => {
    let raw = "";
    req.on("data", (c: Buffer) => (raw += c.toString()));
    req.on("end", () => {
      capturedA.method = req.method ?? "";
      capturedA.body = raw;
      capturedA.headers = flattenHeaders(req.headers);

      const url = req.url ?? "";

      if (url === "/echo-headers") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(capturedA.headers));
        return;
      }
      if (url === "/gz") {
        res.writeHead(200, { "content-encoding": "gzip" });
        res.end(gzipSync(Buffer.from("UNZIPPED")));
        return;
      }
      if (url === "/deflate") {
        res.writeHead(200, { "content-encoding": "deflate" });
        res.end(deflateSync(Buffer.from("DEFLATED")));
        return;
      }
      if (url === "/br") {
        res.writeHead(200, { "content-encoding": "br" });
        res.end(brotliCompressSync(Buffer.from("BROTLI")));
        return;
      }
      // 旧版用例兼容
      if (url === "/clean") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(req.headers["user-agent"] ? "HAS-UA" : "NO-UA");
        return;
      }
      if (url === "/redirect") {
        res.writeHead(302, { location: "/target" });
        res.end();
        return;
      }
      // 302 上带 Set-Cookie, 然后跳到 /target (测重定向链上设置的 cookie 被上报).
      if (url === "/set-cookie-redirect") {
        res.writeHead(302, {
          location: "/target",
          "set-cookie": "sid=abc; Path=/",
        });
        res.end();
        return;
      }
      if (url === "/target") {
        res.writeHead(200);
        res.end("ARRIVED");
        return;
      }
      if (url === "/badredirect") {
        res.writeHead(302, { location: "http://[bad" });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  serverA = result.server;
  portA = result.port;
});

afterAll(() => serverA.close());

// ---------------------------------------------------------------------------
// 用例 (1): content-length
// ---------------------------------------------------------------------------
describe("content-length 与 chunked", () => {
  it("带 body 的 POST 发送正确 content-length 且无 transfer-encoding chunked", async () => {
    const body = "hello world";
    const events = await runSpec({
      method: "POST",
      url: `http://127.0.0.1:${portA}/echo-headers`,
      headers: [],
      body,
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });
    const h = echoedHeaders(events);
    expect(h["content-length"]).toBe(String(Buffer.byteLength(body)));
    const te = (h["transfer-encoding"] ?? "").toLowerCase();
    expect(te).not.toContain("chunked");
  });

  it("body 含多字节 UTF-8 时 content-length 按字节数计", async () => {
    const body = "你好世界"; // 4 个汉字 = 12 字节
    const events = await runSpec({
      method: "POST",
      url: `http://127.0.0.1:${portA}/echo-headers`,
      headers: [],
      body,
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });
    const h = echoedHeaders(events);
    expect(h["content-length"]).toBe(String(Buffer.byteLength(body, "utf8")));
  });
});

// ---------------------------------------------------------------------------
// 用例 (2): 洁净模式 vs 非洁净模式
// ---------------------------------------------------------------------------
describe("洁净模式 (DEFAULT_HEADERS)", () => {
  it("洁净模式不发 user-agent / accept / accept-encoding", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/echo-headers`,
      headers: [],
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });
    const h = echoedHeaders(events);
    expect(h["user-agent"]).toBeUndefined();
    expect(h["accept"]).toBeUndefined();
    expect(h["accept-encoding"]).toBeUndefined();
  });

  it("非洁净模式含 user-agent / accept / accept-encoding", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/echo-headers`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    const h = echoedHeaders(events);
    expect(h["user-agent"]).toBeDefined();
    expect(h["accept"]).toBeDefined();
    expect(h["accept-encoding"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 用例 (3) + (4): 跨源重定向剥离 & 方法降级
// ---------------------------------------------------------------------------
describe("重定向行为 (回归)", () => {
  let serverB: Server;
  let portB: number;

  /** B 服务器最近一次收到的请求元数据. */
  const capturedB: {
    headers: Record<string, string>;
    method: string;
    body: string;
  } = { headers: {}, method: "", body: "" };

  beforeAll(async () => {
    const result = await startServer((req: IncomingMessage, res) => {
      let raw = "";
      req.on("data", (c: Buffer) => (raw += c.toString()));
      req.on("end", () => {
        capturedB.method = req.method ?? "";
        capturedB.body = raw;
        capturedB.headers = flattenHeaders(req.headers);
        res.writeHead(200);
        res.end("B-OK");
      });
    });
    serverB = result.server;
    portB = result.port;
  });

  afterAll(() => serverB.close());

  // (3a) 跨源重定向剥离 authorization
  it("跨源 302 重定向后剥离 authorization 头", async () => {
    // 独立服务器发 302 -> serverB (不同端口 = 跨源)
    const { server: crossServer, port: crossPort } = await startServer(
      (_req, res) => {
        res.writeHead(302, { location: `http://127.0.0.1:${portB}/` });
        res.end();
      },
    );

    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${crossPort}/`,
      headers: [
        {
          id: "1",
          key: "Authorization",
          value: "Bearer secret",
          enabled: true,
        },
      ],
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });

    crossServer.close();

    expect(capturedB.headers["authorization"]).toBeUndefined();
    expect(events.some((e) => e.kind === "end")).toBe(true);
  });

  // (3b) 同源重定向保留 authorization
  it("同源重定向保留 authorization 头", async () => {
    const capturedSame: Record<string, string> = {};
    const { server: sameServer, port: samePort } = await startServer(
      (req: IncomingMessage, res) => {
        let raw = "";
        req.on("data", (c: Buffer) => (raw += c.toString()));
        req.on("end", () => {
          if (req.url === "/") {
            res.writeHead(302, { location: "/dest" });
            res.end();
          } else {
            Object.assign(capturedSame, flattenHeaders(req.headers));
            res.writeHead(200);
            res.end("SAME-OK");
          }
        });
      },
    );

    await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${samePort}/`,
      headers: [
        {
          id: "1",
          key: "Authorization",
          value: "Bearer secret",
          enabled: true,
        },
      ],
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });

    sameServer.close();

    expect(capturedSame["authorization"]).toBe("Bearer secret");
  });

  // (4a) 303 -> GET 去 body
  it("303 重定向将 POST+body 降级为 GET 且 B 无 body", async () => {
    const { server: redirect303, port: port303 } = await startServer(
      (_req, res) => {
        res.writeHead(303, { location: `http://127.0.0.1:${portB}/` });
        res.end();
      },
    );

    await runSpec({
      method: "POST",
      url: `http://127.0.0.1:${port303}/`,
      headers: [],
      body: "payload",
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });

    redirect303.close();

    expect(capturedB.method).toBe("GET");
    expect(capturedB.body).toBe("");
  });

  // (4b) 307 保留方法 + body
  it("307 重定向保留 POST 方法与 body", async () => {
    const { server: redirect307, port: port307 } = await startServer(
      (_req, res) => {
        res.writeHead(307, { location: `http://127.0.0.1:${portB}/` });
        res.end();
      },
    );

    const bodyText = "keep-me";
    await runSpec({
      method: "POST",
      url: `http://127.0.0.1:${port307}/`,
      headers: [],
      body: bodyText,
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });

    redirect307.close();

    expect(capturedB.method).toBe("POST");
    expect(capturedB.body).toBe(bodyText);
  });

  // (4c) 301 对非 GET 降级为 GET
  it("301 对 POST 降级为 GET 且去 body", async () => {
    const { server: redirect301, port: port301 } = await startServer(
      (_req, res) => {
        res.writeHead(301, { location: `http://127.0.0.1:${portB}/` });
        res.end();
      },
    );

    await runSpec({
      method: "POST",
      url: `http://127.0.0.1:${port301}/`,
      headers: [],
      body: "drop-me",
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });

    redirect301.close();

    expect(capturedB.method).toBe("GET");
    expect(capturedB.body).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 用例 (5): 超时
// ---------------------------------------------------------------------------
describe("超时", () => {
  it("慢响应服务端超过 timeoutMs 后发 error 且消息含超时", async () => {
    // 故意不响应 (挂住)
    const { server: slowServer, port: slowPort } = await startServer(() => {
      // 空处理器: 不调用 res.end(), 让连接挂住直至超时
    });

    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${slowPort}/`,
      headers: [],
      cleanMode: true,
      settings: { ...DEFAULT_SETTINGS, timeoutMs: 100 },
    });

    slowServer.close();

    const errorEvent = events.find((e) => e.kind === "error");
    expect(errorEvent).toBeDefined();
    const msg = ((errorEvent?.payload ?? {}) as { message: string }).message;
    expect(msg).toMatch(/超时/);
  });
});

// ---------------------------------------------------------------------------
// 用例 (6): maxRedirects
// ---------------------------------------------------------------------------
describe("maxRedirects", () => {
  it("maxRedirects=1 时跟随一跳后停止, 末跳 3xx 作为最终 status 返回", async () => {
    // hopB 返回 302 (但不会被继续跟随, 因为 maxRedirects=1 已消耗在 hopA->hopB)
    const { server: hopB, port: portHopB } = await startServer((_req, res) => {
      res.writeHead(302, { location: "http://127.0.0.1:1/" });
      res.end();
    });

    const { server: hopA, port: portHopA } = await startServer((_req, res) => {
      res.writeHead(302, { location: `http://127.0.0.1:${portHopB}/` });
      res.end();
    });

    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portHopA}/`,
      headers: [],
      cleanMode: true,
      settings: { ...DEFAULT_SETTINGS, maxRedirects: 1 },
    });

    hopA.close();
    hopB.close();

    const statusEvent = events.find((e) => e.kind === "status");
    const statusCode = (statusEvent?.payload as { statusCode: number })
      ?.statusCode;
    expect(statusCode).toBe(302);
    expect(events.some((e) => e.kind === "end")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 用例 (7): AbortSignal 取消
// ---------------------------------------------------------------------------
describe("AbortSignal 取消", () => {
  it("已 abort 的 signal (用户取消) 中止请求, 不发 error 也不发 end", async () => {
    const controller = new AbortController();
    controller.abort();

    const events: DriverEvent[] = [];
    await executeHttp(
      {
        method: "GET",
        url: `http://127.0.0.1:${portA}/echo-headers`,
        headers: [],
        cleanMode: true,
        settings: DEFAULT_SETTINGS,
      },
      new CookieJar(),
      (e) => events.push(e),
      controller.signal,
    );

    // 用户取消由渲染层的 "已取消" 态呈现, 驱动不应再发 error/end 覆盖之.
    expect(events.some((e) => e.kind === "error")).toBe(false);
    expect(events.some((e) => e.kind === "end")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 用例 (8): deflate 与 br 解压
// ---------------------------------------------------------------------------
describe("自动解压", () => {
  it("deflate 响应自动解压", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/deflate`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(bodyOf(events)).toBe("DEFLATED");
  });

  it("br (brotli) 响应自动解压", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/br`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(bodyOf(events)).toBe("BROTLI");
  });
});

// ---------------------------------------------------------------------------
// 旧版用例兼容 (保留原有 describe 块以免回归)
// ---------------------------------------------------------------------------
describe("executeHttp 扩展 (原有)", () => {
  it("洁净模式不发 User-Agent", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/clean`,
      headers: [],
      cleanMode: true,
      settings: DEFAULT_SETTINGS,
    });
    expect(bodyOf(events)).toBe("NO-UA");
  });

  it("非洁净模式发 User-Agent", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/clean`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(bodyOf(events)).toBe("HAS-UA");
  });

  it("自动跟随 302 重定向", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/redirect`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(bodyOf(events)).toBe("ARRIVED");
  });

  it("重定向跳设置的 Set-Cookie 会上报 cookie 事件 (跟随到无 Set-Cookie 的目标)", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/set-cookie-redirect`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    // 最终落到 /target (无 Set-Cookie), 但 302 跳上设的 cookie 应经 cookie 事件上报.
    const cookieEvent = events.find((e) => e.kind === "cookie");
    expect(cookieEvent).toBeDefined();
    const { setCookie } = cookieEvent?.payload as { setCookie: string[] };
    expect(setCookie.some((c) => c.startsWith("sid=abc"))).toBe(true);
    expect(bodyOf(events)).toBe("ARRIVED");
  });

  it("请求带出 Cookie 头时上报 sent cookie 事件 (对应访问已有 cookie 的地址)", async () => {
    // 预置 jar, 使下次请求带出 Cookie 头.
    const jar = new CookieJar();
    jar.setFromHeaders(`http://127.0.0.1:${portA}/`, ["sid=xyz; Path=/"]);
    const events: DriverEvent[] = [];
    await executeHttp(
      {
        method: "GET",
        url: `http://127.0.0.1:${portA}/target`,
        headers: [],
        cleanMode: false,
        settings: DEFAULT_SETTINGS,
      },
      jar,
      (e) => events.push(e),
      new AbortController().signal,
    );
    const sentEvent = events.find(
      (e) =>
        e.kind === "cookie" &&
        (e.payload as { sent?: string }).sent !== undefined,
    );
    expect(sentEvent).toBeDefined();
    expect((sentEvent?.payload as { sent: string }).sent).toContain("sid=xyz");
  });

  it("自动解压 gzip 响应体", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/gz`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(bodyOf(events)).toBe("UNZIPPED");
  });

  it("重定向到非法 Location 时发 error 且 Promise 落定 (不永挂)", async () => {
    const events = await runSpec({
      method: "GET",
      url: `http://127.0.0.1:${portA}/badredirect`,
      headers: [],
      cleanMode: false,
      settings: DEFAULT_SETTINGS,
    });
    expect(events.some((e) => e.kind === "error")).toBe(true);
    expect(events.some((e) => e.kind === "end")).toBe(false);
  });
});
