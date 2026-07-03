// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CookieJar } from "./cookie-jar";
import { executeHttp } from "./http-driver";
import type { DriverEvent, HttpRequestSpec } from "./request-channels";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/echo") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.writeHead(200, {
          "content-type": "application/json",
          "x-method": req.method ?? "",
          "x-ua": req.headers["user-agent"] ?? "none",
        });
        res.end(JSON.stringify({ got: body }));
      });
      return;
    }
    res.writeHead(404);
    res.end("nope");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
});

const settings = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 10000,
  sslVerify: true,
};

function collect(): {
  events: DriverEvent[];
  onEvent: (e: DriverEvent) => void;
  body: () => string;
} {
  const events: DriverEvent[] = [];
  return {
    events,
    onEvent: (e) => events.push(e),
    body: () =>
      events
        .filter((e) => e.kind === "chunk")
        .map((e) =>
          Buffer.from((e.payload as { base64: string }).base64, "base64"),
        )
        .reduce((acc, b) => Buffer.concat([acc, b]), Buffer.alloc(0))
        .toString(),
  };
}

describe("executeHttp 基础", () => {
  it("POST 回显请求体并发出 status/headers/chunk/end", async () => {
    const spec: HttpRequestSpec = {
      method: "POST",
      url: `http://127.0.0.1:${port}/echo`,
      headers: [],
      body: "hello",
      cleanMode: false,
      settings,
    };
    const c = collect();
    await executeHttp(
      spec,
      new CookieJar(),
      c.onEvent,
      new AbortController().signal,
    );
    const status = c.events.find((e) => e.kind === "status");
    expect((status?.payload as { statusCode: number }).statusCode).toBe(200);
    expect(c.events.some((e) => e.kind === "headers")).toBe(true);
    expect(c.events.at(-1)?.kind).toBe("end");
    expect(JSON.parse(c.body())).toEqual({ got: "hello" });
  });

  it("非洁净模式自动补 User-Agent", async () => {
    const spec: HttpRequestSpec = {
      method: "GET",
      url: `http://127.0.0.1:${port}/echo`,
      headers: [],
      cleanMode: false,
      settings,
    };
    const c = collect();
    await executeHttp(
      spec,
      new CookieJar(),
      c.onEvent,
      new AbortController().signal,
    );
    const headers = c.events.find((e) => e.kind === "headers")
      ?.payload as Record<string, string>;
    expect(headers["x-ua"]).not.toBe("none");
  });

  it("用户自定义头优先发送", async () => {
    const spec: HttpRequestSpec = {
      method: "GET",
      url: `http://127.0.0.1:${port}/echo`,
      headers: [
        { id: "1", key: "User-Agent", value: "radish/1", enabled: true },
        { id: "2", key: "X-Skip", value: "v", enabled: false },
      ],
      cleanMode: false,
      settings,
    };
    const c = collect();
    await executeHttp(
      spec,
      new CookieJar(),
      c.onEvent,
      new AbortController().signal,
    );
    const headers = c.events.find((e) => e.kind === "headers")
      ?.payload as Record<string, string>;
    expect(headers["x-ua"]).toBe("radish/1");
  });
});
