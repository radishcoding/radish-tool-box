// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ConnectionConfig, DriverEvent } from "./request-channels";
import { connectSse } from "./sse-driver";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write("event: greet\ndata: hello\n\n");
    res.write("data: line1\ndata: line2\n\n");
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

const config = (url: string): ConnectionConfig => ({
  protocol: "sse",
  sse: {
    url,
    headers: [],
    settings: {
      followRedirects: true,
      maxRedirects: 5,
      timeoutMs: 10000,
      sslVerify: true,
    },
  },
});

describe("connectSse", () => {
  it("解析 event/多行 data, 逐事件回传 message", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectSse(config(`http://127.0.0.1:${port}/sse`), (e) => {
        events.push(e);
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    const messages = events.filter((e) => e.kind === "message");
    expect(messages).toHaveLength(2);
    expect(
      messages[0].payload as { event: string; data: string },
    ).toMatchObject({ event: "greet", data: "hello" });
    expect((messages[1].payload as { data: string }).data).toBe("line1\nline2");
  });

  // 回归 #1: 非 2xx 响应发 error 而非 open, 随后 closed
  it("非 2xx 服务端返回 404, 发 error (非 open) 且随后 closed", async () => {
    // 建独立服务器: 返回 404
    const srv404 = createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) =>
      srv404.listen(0, "127.0.0.1", resolve),
    );
    const p404 = (srv404.address() as AddressInfo).port;

    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectSse(config(`http://127.0.0.1:${p404}/nope`), (e) => {
        events.push(e);
        if (e.kind === "closed") {
          resolve();
        }
      });
    });

    srv404.close();

    expect(events.find((e) => e.kind === "open")).toBeUndefined();
    const err = events.find((e) => e.kind === "error");
    expect(err).toBeDefined();
    expect((err?.payload as { message: string }).message).toMatch("404");
    expect(events.find((e) => e.kind === "closed")).toBeDefined();
  });

  // 回归 #2: 流正常结束后再调 close(), closed 事件恰好 1 次
  it("流结束后再 close(), closed 事件恰好 1 次", async () => {
    const events: DriverEvent[] = [];
    let handle: ReturnType<typeof connectSse>;
    await new Promise<void>((resolve) => {
      handle = connectSse(config(`http://127.0.0.1:${port}/sse`), (e) => {
        events.push(e);
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    // 流已自然结束, 再主动 close
    handle!.close();
    // 等一个 tick 让可能的额外事件到达
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    const closedCount = events.filter((e) => e.kind === "closed").length;
    expect(closedCount).toBe(1);
  });

  // 高优 #3: 流中途 res.destroy() 中断, 发出 error (aborted 前) + closed
  it("流中途 destroy, 发出 error + closed", async () => {
    const srvAbort = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("data: partial\n\n");
      // 写一帧后直接销毁连接
      setImmediate(() => res.destroy());
    });
    await new Promise<void>((resolve) =>
      srvAbort.listen(0, "127.0.0.1", resolve),
    );
    const pAbort = (srvAbort.address() as AddressInfo).port;

    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectSse(config(`http://127.0.0.1:${pAbort}/abort`), (e) => {
        events.push(e);
        if (e.kind === "closed") {
          resolve();
        }
      });
    });

    srvAbort.close();

    // open 到达 (2xx 已经发了), 随后 error, 最后 closed
    expect(events.find((e) => e.kind === "open")).toBeDefined();
    expect(events.find((e) => e.kind === "error")).toBeDefined();
    expect(events.find((e) => e.kind === "closed")).toBeDefined();
  });
});
