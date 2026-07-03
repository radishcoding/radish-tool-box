// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";

import type { ConnectionConfig, DriverEvent } from "./request-channels";
import { connectWs } from "./ws-driver";

let server: WebSocketServer;
let port: number;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = new WebSocketServer({ port: 0, host: "127.0.0.1" }, resolve);
    server.on("connection", (socket) => {
      socket.on("message", (data: Buffer) =>
        socket.send(`echo:${data.toString()}`),
      );
    });
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

const config = (url: string): ConnectionConfig => ({
  protocol: "websocket",
  ws: {
    url,
    headers: [],
    subprotocols: [],
    settings: {
      followRedirects: true,
      maxRedirects: 5,
      timeoutMs: 10000,
      sslVerify: true,
    },
  },
});

describe("connectWs", () => {
  it("连接 open, 发送回声为 message, 关闭 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectWs(config(`ws://127.0.0.1:${port}`), (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.send({ event: "", data: "ping" });
        }
        if (e.kind === "message") {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    expect(events.find((e) => e.kind === "open")).toBeDefined();
    const msg = events.find((e) => e.kind === "message");
    expect((msg?.payload as { data: string }).data).toBe("echo:ping");
    expect(events.find((e) => e.kind === "closed")).toBeDefined();
  });

  // #4: 连接失败 - 连未监听端口发 error
  it("连未监听端口, 发出 error", async () => {
    // 用一个肯定无监听的随机高端口
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectWs(config("ws://127.0.0.1:19999"), (e) => {
        events.push(e);
        if (e.kind === "error" || e.kind === "closed") {
          resolve();
        }
      });
    });
    expect(events.find((e) => e.kind === "error")).toBeDefined();
  });

  // #5: close-before-open - 握手未完成时同步调 close(), 自发 closed 且不崩
  it("握手前同步 close(), 发出 closed 且不崩", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      // 连真实服务器但握手有延迟, 立即 close
      const handle = connectWs(config(`ws://127.0.0.1:${port}`), (e) => {
        events.push(e);
        if (e.kind === "closed" || e.kind === "error") {
          resolve();
        }
      });
      // buildTlsOptions 是 async, socket 还未构造
      handle.close();
    });

    // 只要不崩, 且发出了 closed (可能来自 close-before-open 路径或正常 close)
    const hasClosed = events.find((e) => e.kind === "closed");
    expect(hasClosed).toBeDefined();
  });

  // #6: 二进制帧 - 服务端发 Buffer, data 为 "[二进制 N 字节] <base64>"
  it("服务端发送二进制帧, message data 含 [二进制 N 字节] 和 base64", async () => {
    const binaryServer = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise<void>((resolve) => binaryServer.on("listening", resolve));
    const binaryPort = (binaryServer.address() as AddressInfo).port;

    const payload = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    binaryServer.on("connection", (ws) => {
      ws.send(payload);
    });

    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectWs(config(`ws://127.0.0.1:${binaryPort}`), (e) => {
        events.push(e);
        if (e.kind === "message") {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });

    binaryServer.close();

    const msg = events.find((e) => e.kind === "message");
    const data = (msg?.payload as { data: string }).data;
    expect(data).toMatch(/^\[二进制 4 字节\] /);
    expect(data).toBe(`[二进制 4 字节] ${payload.toString("base64")}`);
  });
});
