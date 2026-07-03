// @vitest-environment node
import { createServer, type Server, type AddressInfo } from "node:net";
import { Aedes } from "aedes";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ConnectionConfig, DriverEvent } from "./request-channels";
import { connectMqtt } from "./mqtt-driver";

let broker: Aedes;
let server: Server;
let port: number;

beforeAll(async () => {
  broker = new Aedes();
  // aedes 1.1.0 需要先调用 listen() 初始化持久化层, 否则 persistence 为 undefined.
  await broker.listen();
  // broker.handle 接受 Duplex | Socket; createServer 回调签名兼容, 受控收窄.
  server = createServer(broker.handle as Parameters<typeof createServer>[0]);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => broker.close(() => resolve()));
});

const config = (url: string): ConnectionConfig => ({
  protocol: "mqtt",
  mqtt: {
    url,
    clientId: "test-client",
    username: "",
    password: "",
    subscriptions: [{ topic: "test/topic", qos: 0 }],
    settings: {
      followRedirects: true,
      maxRedirects: 5,
      timeoutMs: 10000,
      sslVerify: true,
    },
  },
});

describe("connectMqtt", () => {
  it("连接 open, 订阅后发布到 test/topic 收到回环 message (event=topic), 断开 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectMqtt(config(`mqtt://127.0.0.1:${port}`), (e) => {
        events.push(e);
        if (e.kind === "open") {
          // 订阅生效后发布到自身订阅的主题.
          handle.send({ event: "test/topic", data: "hello", qos: 0 });
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
    expect((msg?.payload as { event: string; data: string }).event).toBe(
      "test/topic",
    );
    expect((msg?.payload as { data: string }).data).toBe("hello");
    expect(events.find((e) => e.kind === "closed")).toBeDefined();
  });

  // #10: 空订阅不死锁 - subscriptions: [] 直接发 open 不卡
  it("空订阅列表直接发 open, 不死锁", async () => {
    const emptySubConfig: ConnectionConfig = {
      protocol: "mqtt",
      mqtt: {
        url: `mqtt://127.0.0.1:${port}`,
        clientId: "test-empty-sub",
        username: "",
        password: "",
        subscriptions: [],
        settings: {
          followRedirects: true,
          maxRedirects: 5,
          timeoutMs: 5000,
          sslVerify: true,
        },
      },
    };

    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectMqtt(emptySubConfig, (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });

    expect(events.find((e) => e.kind === "open")).toBeDefined();
    expect(events.find((e) => e.kind === "closed")).toBeDefined();
  });

  // #11: publish qos:1 - broker 收到对应 qos
  it("publish qos:1, broker 收到发布", async () => {
    const qos1Config: ConnectionConfig = {
      protocol: "mqtt",
      mqtt: {
        url: `mqtt://127.0.0.1:${port}`,
        clientId: "test-qos1",
        username: "",
        password: "",
        subscriptions: [{ topic: "qos1/test", qos: 1 }],
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
      const handle = connectMqtt(qos1Config, (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.send({ event: "qos1/test", data: "qos1-payload", qos: 1 });
        }
        if (
          e.kind === "message" &&
          (e.payload as { event: string }).event === "qos1/test"
        ) {
          handle.close();
        }
        if (e.kind === "closed") {
          resolve();
        }
      });
    });

    expect(events.find((e) => e.kind === "open")).toBeDefined();
    const msg = events.find(
      (e) =>
        e.kind === "message" &&
        (e.payload as { event: string }).event === "qos1/test",
    );
    expect(msg).toBeDefined();
    expect((msg?.payload as { data: string }).data).toBe("qos1-payload");
  });

  // #12: 连接失败 - 坏端口/坏 url 发 error
  it("连坏端口, 发出 error", async () => {
    const badConfig: ConnectionConfig = {
      protocol: "mqtt",
      mqtt: {
        url: "mqtt://127.0.0.1:19997",
        clientId: "test-bad",
        username: "",
        password: "",
        subscriptions: [],
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
      connectMqtt(badConfig, (e) => {
        events.push(e);
        if (e.kind === "error" || e.kind === "closed") {
          resolve();
        }
      });
    });

    expect(events.find((e) => e.kind === "error")).toBeDefined();
  });
});
