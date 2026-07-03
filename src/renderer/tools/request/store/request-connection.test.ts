import { beforeEach, describe, expect, it } from "vitest";

import type { Message, StreamEvent } from "../model/types";
import { useRequestStore } from "./request-store";

function reset(): void {
  useRequestStore.setState({
    tabs: [],
    activeTabId: undefined,
    sidebarSection: "collections",
    responses: {},
    jobToTab: {},
    collections: [],
    environments: [],
    globals: [],
    activeEnvironmentId: undefined,
    history: [],
    connections: {},
  });
}

const ev = (
  jobId: string,
  kind: StreamEvent["kind"],
  payload: unknown,
): StreamEvent => ({ jobId, kind, payload });

describe("store 连接切片", () => {
  beforeEach(reset);

  it("newProtocolTab 建 ws 标签带默认配置", () => {
    useRequestStore.getState().newProtocolTab("websocket");
    const tab = useRequestStore.getState().tabs[0];
    expect(tab.protocol).toBe("websocket");
    expect(tab.ws?.url).toBe("");
  });

  it("startConnection + applyConnectionEvent 累积消息与状态 (open/closed 也入消息流)", () => {
    const store = useRequestStore.getState();
    store.startConnection("t1", "j1");
    expect(useRequestStore.getState().connections["t1"].status).toBe(
      "connecting",
    );
    store.applyConnectionEvent(ev("j1", "open", { info: "ok" }));
    let conn = useRequestStore.getState().connections["t1"];
    expect(conn.status).toBe("open");
    // open 入流为系统消息.
    expect(conn.messages).toHaveLength(1);
    expect(conn.messages[0]).toMatchObject({ direction: "system", data: "ok" });
    store.applyConnectionEvent(
      ev("j1", "message", { direction: "received", event: "e", data: "d" }),
    );
    expect(useRequestStore.getState().connections["t1"].messages).toHaveLength(
      2,
    );
    store.applyConnectionEvent(
      ev("j1", "closed", { code: 1000, reason: "bye" }),
    );
    conn = useRequestStore.getState().connections["t1"];
    expect(conn.status).toBe("closed");
    // closed 入流为系统消息 (带原因), 只一条.
    expect(conn.messages).toHaveLength(3);
    expect(conn.messages[2]).toMatchObject({
      direction: "system",
      data: "已关闭: bye",
    });
  });

  it("updateConnectionSettings 更新当前协议的 TLS settings", () => {
    const store = useRequestStore.getState();
    store.newProtocolTab("tcp");
    const id = useRequestStore.getState().tabs[0].id;
    store.updateConnectionSettings(id, {
      sslVerify: false,
      customCaPath: "/ca.pem",
    });
    const s = useRequestStore.getState().tabs[0].tcp?.settings;
    expect(s?.sslVerify).toBe(false);
    expect(s?.customCaPath).toBe("/ca.pem");
  });

  it("appendSentMessage 追加发送消息", () => {
    const store = useRequestStore.getState();
    store.startConnection("t1", "j1");
    const m: Message = {
      id: "m1",
      direction: "sent",
      time: 0,
      event: "",
      data: "hi",
    };
    store.appendSentMessage("t1", m);
    const msgs = useRequestStore.getState().connections["t1"].messages;
    expect(msgs[0].direction).toBe("sent");
  });

  it("未知 jobId 事件忽略", () => {
    useRequestStore.getState().applyConnectionEvent(ev("ghost", "open", {}));
    expect(useRequestStore.getState().connections).toEqual({});
  });

  it("updateConnectionHeaders 按协议更新头", () => {
    const store = useRequestStore.getState();
    store.newProtocolTab("websocket");
    const id = useRequestStore.getState().tabs[0].id;
    store.updateConnectionHeaders(id, [
      { id: "h1", key: "X", value: "1", enabled: true },
    ]);
    expect(useRequestStore.getState().tabs[0].ws?.headers).toHaveLength(1);
  });

  it("updateWsSubprotocols / updateSocketIoNamespace", () => {
    const store = useRequestStore.getState();
    store.newProtocolTab("websocket");
    const wsId = useRequestStore.getState().tabs[0].id;
    store.updateWsSubprotocols(wsId, ["v1", "v2"]);
    expect(useRequestStore.getState().tabs[0].ws?.subprotocols).toEqual([
      "v1",
      "v2",
    ]);
    store.newProtocolTab("socketio");
    const sioId = useRequestStore.getState().tabs[1].id;
    store.updateSocketIoNamespace(sioId, "/chat");
    expect(useRequestStore.getState().tabs[1].socketio?.namespace).toBe(
      "/chat",
    );
  });

  it("newProtocolTab tcp + updateTcpConfig", () => {
    const store = useRequestStore.getState();
    store.newProtocolTab("tcp");
    const tab = useRequestStore.getState().tabs[0];
    expect(tab.protocol).toBe("tcp");
    expect(tab.tcp?.port).toBe(0);
    store.updateTcpConfig(tab.id, { host: "127.0.0.1", port: 9000, tls: true });
    const updated = useRequestStore.getState().tabs[0];
    expect(updated.tcp).toMatchObject({
      host: "127.0.0.1",
      port: 9000,
      tls: true,
    });
  });

  it("newProtocolTab mqtt + updateMqttConfig + updateMqttSubscriptions", () => {
    const store = useRequestStore.getState();
    store.newProtocolTab("mqtt");
    const id = useRequestStore.getState().tabs[0].id;
    expect(useRequestStore.getState().tabs[0].protocol).toBe("mqtt");
    store.updateMqttConfig(id, {
      url: "mqtt://127.0.0.1:1883",
      clientId: "c1",
    });
    store.updateMqttSubscriptions(id, [{ topic: "a/b", qos: 2 }]);
    const tab = useRequestStore.getState().tabs[0];
    expect(tab.mqtt).toMatchObject({
      url: "mqtt://127.0.0.1:1883",
      clientId: "c1",
    });
    expect(tab.mqtt?.subscriptions[0]).toEqual({ topic: "a/b", qos: 2 });
  });

  it("newProtocolTab grpc + updateGrpcConfig + setGrpcServices", () => {
    const store = useRequestStore.getState();
    store.newProtocolTab("grpc");
    const id = useRequestStore.getState().tabs[0].id;
    expect(useRequestStore.getState().tabs[0].protocol).toBe("grpc");
    store.updateGrpcConfig(id, {
      target: "127.0.0.1:50051",
      serviceName: "greet.Greeter",
      methodName: "SayHello",
    });
    store.setGrpcServices(id, [
      {
        name: "greet.Greeter",
        methods: [
          { name: "SayHello", requestStream: false, responseStream: false },
        ],
      },
    ]);
    const tab = useRequestStore.getState().tabs[0];
    expect(tab.grpc).toMatchObject({
      target: "127.0.0.1:50051",
      serviceName: "greet.Greeter",
    });
    expect(tab.grpcServices?.[0].name).toBe("greet.Greeter");
  });

  // ── 高: applyConnectionEvent jobId 不匹配 ──────────────────────────────────
  it("applyConnectionEvent: jobId 不匹配时状态不变 (旧事件防串)", () => {
    const store = useRequestStore.getState();
    // 用新 jobId 建立连接.
    store.startConnection("t1", "new-job");
    const before = useRequestStore.getState().connections["t1"];
    // 用旧 jobId 发 open 事件 -- 应被忽略.
    // 先把旧 jobId 注册到 jobToTab 以便能查到 tabId, 再检查 jobId 不匹配.
    useRequestStore.setState((s) => ({
      jobToTab: { ...s.jobToTab, "old-job": "t1" },
    }));
    store.applyConnectionEvent(ev("old-job", "open", {}));
    const after = useRequestStore.getState().connections["t1"];
    expect(after).toEqual(before);
  });

  // ── 中: applyConnectionEvent error 事件 ────────────────────────────────────
  it("applyConnectionEvent error 事件置 status=error 并记 message", () => {
    const store = useRequestStore.getState();
    store.startConnection("t1", "j-err");
    store.applyConnectionEvent(ev("j-err", "error", { message: "连接超时" }));
    const conn = useRequestStore.getState().connections["t1"];
    expect(conn.status).toBe("error");
    expect(conn.error).toBe("连接超时");
    // error 也入消息流为系统消息.
    expect(conn.messages.at(-1)).toMatchObject({
      direction: "system",
      data: "错误: 连接超时",
    });
  });
});
