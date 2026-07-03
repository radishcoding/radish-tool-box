// @vitest-environment node
import { createServer, type AddressInfo, type Server } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ConnectionConfig, DriverEvent } from "./request-channels";
import { connectTcp } from "./tcp-driver";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((socket) => {
    socket.on("data", (data: Buffer) =>
      socket.write(Buffer.concat([Buffer.from("echo:"), data])),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

const config = (host: string, p: number): ConnectionConfig => ({
  protocol: "tcp",
  tcp: {
    host,
    port: p,
    tls: false,
    settings: {
      followRedirects: true,
      maxRedirects: 5,
      timeoutMs: 10000,
      sslVerify: true,
    },
  },
});

describe("connectTcp", () => {
  it("连接 open, 文本发送收到 echo message 带 size, 关闭 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectTcp(config("127.0.0.1", port), (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.send({ event: "", data: "ping", format: "text" });
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
    expect((msg?.payload as { size: number }).size).toBe(9);
    expect(events.find((e) => e.kind === "closed")).toBeDefined();
  });

  it("Hex 发送被解码为字节", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectTcp(config("127.0.0.1", port), (e) => {
        events.push(e);
        if (e.kind === "open") {
          // 68 69 = "hi"
          handle.send({ event: "", data: "68 69", format: "hex" });
        }
        if (e.kind === "message") {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    const msg = events.find((e) => e.kind === "message");
    expect((msg?.payload as { data: string }).data).toBe("echo:hi");
  });

  // #7: 连接失败 - 连未监听端口发 error
  it("连未监听端口, 发出 error", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectTcp(config("127.0.0.1", 19998), (e) => {
        events.push(e);
        if (e.kind === "error" || e.kind === "closed") {
          resolve();
        }
      });
    });
    expect(events.find((e) => e.kind === "error")).toBeDefined();
  });

  // #8: hex 非法回退 - 非法 hex 字符 "zz" 按 utf8 字节发送 (echo 回来是原文)
  it("hex 格式非法字符 zz, 回退 utf8 原文发送", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectTcp(config("127.0.0.1", port), (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.send({ event: "", data: "zz", format: "hex" });
        }
        if (e.kind === "message") {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    const msg = events.find((e) => e.kind === "message");
    // "zz" 按 utf8 发送, echo 回来是 "echo:zz"
    expect((msg?.payload as { data: string }).data).toBe("echo:zz");
  });

  // #8b: hex 奇数长度回退
  it("hex 格式奇数长度 (abc), 回退 utf8 原文发送", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectTcp(config("127.0.0.1", port), (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.send({ event: "", data: "abc", format: "hex" });
        }
        if (e.kind === "message") {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    const msg = events.find((e) => e.kind === "message");
    // "abc" 奇数长度不合法 hex, 按 utf8 原文发送
    expect((msg?.payload as { data: string }).data).toBe("echo:abc");
  });

  // #9: close-before-open / emitClosed 幂等 - 服务端断开 + 客户端 close 不双发 closed
  it("服务端断开 + 客户端 close(), closed 只发一次", async () => {
    // 建一个接到即关闭的服务器
    const closeServer = createServer((socket) => {
      setImmediate(() => socket.destroy());
    });
    await new Promise<void>((resolve) =>
      closeServer.listen(0, "127.0.0.1", resolve),
    );
    const closePort = (closeServer.address() as AddressInfo).port;

    const events: DriverEvent[] = [];
    let handle: ReturnType<typeof connectTcp>;
    await new Promise<void>((resolve) => {
      handle = connectTcp(config("127.0.0.1", closePort), (e) => {
        events.push(e);
        if (e.kind === "closed") {
          resolve();
        }
      });
    });
    // 服务端已断开, 再主动 close
    handle!.close();
    await new Promise<void>((r) => setTimeout(r, 20));

    closeServer.close();

    const closedCount = events.filter((e) => e.kind === "closed").length;
    expect(closedCount).toBe(1);
  });
});
