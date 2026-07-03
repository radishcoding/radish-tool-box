// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveConnectionConfig } from "./connection-resolve";
import type { ConnectionConfig, VariableScopes } from "./request-channels";

const scopes: VariableScopes = {
  global: { host: "echo.example.com", token: "abc" },
  collection: {},
  environment: { ns: "/chat" },
  local: {},
};

const settings = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 10000,
  sslVerify: true,
};

describe("resolveConnectionConfig", () => {
  it("解析 ws url/头/子协议", () => {
    const config: ConnectionConfig = {
      protocol: "websocket",
      ws: {
        url: "wss://{{host}}/socket",
        headers: [
          {
            id: "1",
            key: "Authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
        ],
        subprotocols: ["v1.{{token}}"],
        settings,
      },
    };
    const out = resolveConnectionConfig(config, scopes);
    if (out.protocol !== "websocket") throw new Error("协议错");
    expect(out.ws.url).toBe("wss://echo.example.com/socket");
    expect(out.ws.headers[0].value).toBe("Bearer abc");
    expect(out.ws.subprotocols[0]).toBe("v1.abc");
  });

  it("解析 socketio url/namespace", () => {
    const config: ConnectionConfig = {
      protocol: "socketio",
      socketio: {
        url: "https://{{host}}",
        headers: [],
        namespace: "{{ns}}",
        settings,
      },
    };
    const out = resolveConnectionConfig(config, scopes);
    if (out.protocol !== "socketio") throw new Error("协议错");
    expect(out.socketio.url).toBe("https://echo.example.com");
    expect(out.socketio.namespace).toBe("/chat");
  });

  it("解析 sse url/头, 未知键原样", () => {
    const config: ConnectionConfig = {
      protocol: "sse",
      sse: {
        url: "https://{{host}}/{{unknown}}",
        headers: [{ id: "1", key: "X", value: "{{token}}", enabled: true }],
        settings,
      },
    };
    const out = resolveConnectionConfig(config, scopes);
    if (out.protocol !== "sse") throw new Error("协议错");
    expect(out.sse.url).toBe("https://echo.example.com/{{unknown}}");
    expect(out.sse.headers[0].value).toBe("abc");
  });

  it("解析 tcp host", () => {
    const config: ConnectionConfig = {
      protocol: "tcp",
      tcp: { host: "{{host}}", port: 9000, tls: false, settings },
    };
    const out = resolveConnectionConfig(config, scopes);
    if (out.protocol !== "tcp") throw new Error("协议错");
    expect(out.tcp.host).toBe("echo.example.com");
    expect(out.tcp.port).toBe(9000);
  });

  it("解析 mqtt url/clientId/订阅主题", () => {
    const config: ConnectionConfig = {
      protocol: "mqtt",
      mqtt: {
        url: "mqtt://{{host}}:1883",
        clientId: "cli-{{token}}",
        username: "{{token}}",
        password: "",
        subscriptions: [{ topic: "dev/{{ns}}", qos: 1 }],
        settings,
      },
    };
    const out = resolveConnectionConfig(config, scopes);
    if (out.protocol !== "mqtt") throw new Error("协议错");
    expect(out.mqtt.url).toBe("mqtt://echo.example.com:1883");
    expect(out.mqtt.clientId).toBe("cli-abc");
    expect(out.mqtt.subscriptions[0].topic).toBe("dev//chat");
  });

  it("解析 grpc target/metadata/请求消息", () => {
    const config: ConnectionConfig = {
      protocol: "grpc",
      grpc: {
        protoSource: { kind: "text", value: "" },
        target: "{{host}}:50051",
        tls: false,
        serviceName: "greet.Greeter",
        methodName: "SayHello",
        metadata: [
          {
            id: "1",
            key: "authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
        ],
        requestMessage: '{"name":"{{token}}"}',
        settings,
      },
    };
    const out = resolveConnectionConfig(config, scopes);
    if (out.protocol !== "grpc") throw new Error("协议错");
    expect(out.grpc.target).toBe("echo.example.com:50051");
    expect(out.grpc.metadata[0].value).toBe("Bearer abc");
    expect(out.grpc.requestMessage).toBe('{"name":"abc"}');
  });

  // #15: 不改入参 - 解析后原 config 未被 mutate; tcp port/mqtt qos 等未列字段原样保留
  it("解析后不改变原始入参 (tcp port 原样保留)", () => {
    const originalPort = 9000;
    const config: ConnectionConfig = {
      protocol: "tcp",
      tcp: { host: "{{host}}", port: originalPort, tls: false, settings },
    };
    // 深拷贝一份用于比较
    const before = JSON.parse(JSON.stringify(config)) as ConnectionConfig;
    resolveConnectionConfig(config, scopes);
    // 原对象不被修改
    expect(config).toEqual(before);
    if (config.protocol !== "tcp") throw new Error("协议错");
    expect(config.tcp.port).toBe(originalPort);
    expect(config.tcp.host).toBe("{{host}}"); // 原文未替换
  });

  it("解析后不改变原始入参 (mqtt qos 原样保留)", () => {
    const config: ConnectionConfig = {
      protocol: "mqtt",
      mqtt: {
        url: "mqtt://{{host}}:1883",
        clientId: "cli",
        username: "",
        password: "",
        subscriptions: [{ topic: "t/{{token}}", qos: 2 }],
        settings,
      },
    };
    const before = JSON.parse(JSON.stringify(config)) as ConnectionConfig;
    const out = resolveConnectionConfig(config, scopes);
    // 原对象不被修改
    expect(config).toEqual(before);
    // qos 在解析后的输出中原样保留
    if (out.protocol !== "mqtt") throw new Error("协议错");
    expect(out.mqtt.subscriptions[0].qos).toBe(2);
  });
});
