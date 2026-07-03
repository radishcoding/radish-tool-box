// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Server as IoServer } from "socket.io";

import type { ConnectionConfig, DriverEvent } from "./request-channels";
import { connectSocketIo } from "./socketio-driver";

let http: Server;
let io: IoServer;
let port: number;

beforeAll(async () => {
  http = createServer();
  io = new IoServer(http);
  io.on("connection", (socket) => {
    socket.on("ping", (msg: unknown) => socket.emit("pong", msg));
  });
  // /chat namespace echo server
  io.of("/chat").on("connection", (socket) => {
    socket.emit("welcome", "joined-chat");
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  port = (http.address() as AddressInfo).port;
});

afterAll(() => {
  io.close();
  http.close();
});

const config = (url: string): ConnectionConfig => ({
  protocol: "socketio",
  socketio: {
    url,
    headers: [],
    namespace: "",
    settings: {
      followRedirects: true,
      maxRedirects: 5,
      timeoutMs: 10000,
      sslVerify: true,
    },
  },
});

describe("connectSocketIo", () => {
  it("连接 open, emit 事件收到回声 message", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectSocketIo(
        config(`http://127.0.0.1:${port}`),
        (e) => {
          events.push(e);
          if (e.kind === "open") {
            handle.send({ event: "ping", data: '"hi"' });
          }
          if (e.kind === "message") {
            handle.close();
            resolve();
          }
        },
      );
    });
    expect(events.find((e) => e.kind === "open")).toBeDefined();
    const msg = events.find((e) => e.kind === "message");
    expect((msg?.payload as { event: string }).event).toBe("pong");
  });

  // #13: connect_error - 连坏地址发 error
  it("连坏地址, 发出 error", async () => {
    const badConfig: ConnectionConfig = {
      protocol: "socketio",
      socketio: {
        url: "http://127.0.0.1:19996",
        headers: [],
        namespace: "",
        settings: {
          followRedirects: true,
          maxRedirects: 5,
          timeoutMs: 3000,
          sslVerify: true,
        },
      },
    };

    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectSocketIo(badConfig, (e) => {
        events.push(e);
        if (e.kind === "error" || e.kind === "closed") {
          resolve();
        }
      });
    });

    expect(events.find((e) => e.kind === "error")).toBeDefined();
  });

  // #14: namespace - 连接到 /chat 命名空间, 验证收到服务端在该 namespace 发的欢迎消息
  it("namespace /chat, 连接后收到 welcome 消息", async () => {
    const nsConfig: ConnectionConfig = {
      protocol: "socketio",
      socketio: {
        url: `http://127.0.0.1:${port}`,
        headers: [],
        namespace: "/chat",
        settings: {
          followRedirects: true,
          maxRedirects: 5,
          timeoutMs: 10000,
          sslVerify: true,
        },
      },
    };

    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectSocketIo(nsConfig, (e) => {
        events.push(e);
        if (e.kind === "message") {
          handle.close();
          resolve();
        }
        // 防止 open 后无消息时卡住
        if (e.kind === "closed") {
          resolve();
        }
      });
    });

    expect(events.find((e) => e.kind === "open")).toBeDefined();
    const msg = events.find((e) => e.kind === "message");
    expect(msg).toBeDefined();
    expect((msg?.payload as { event: string }).event).toBe("welcome");
    expect((msg?.payload as { data: string }).data).toBe("joined-chat");
  });
});
