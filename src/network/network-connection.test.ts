// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  connectToSender,
  registerConnectors,
  type ConnectionHandle,
} from "./network-ipc";
import {
  REQUEST_CHANNEL,
  type ConnectJob,
  type DriverEvent,
  type StreamEvent,
} from "./request-channels";

describe("连接 IPC 往返 (stub echo 驱动)", () => {
  it("connect 打开并回传 open, send 回声为 message, disconnect 关闭", () => {
    // 注册一个 echo stub: 立即 open, send 时回声一条 received message.
    let emitRef: ((e: DriverEvent) => void) | undefined;
    registerConnectors({
      websocket: (_config, onEvent) => {
        emitRef = onEvent;
        onEvent({ kind: "open", payload: { info: "ok" } });
        const handle: ConnectionHandle = {
          send: (m) =>
            onEvent({
              kind: "message",
              payload: { direction: "received", event: "", data: m.data },
            }),
          close: () =>
            onEvent({ kind: "closed", payload: { code: 1000, reason: "bye" } }),
        };
        return handle;
      },
    });

    const sent: StreamEvent[] = [];
    const sender = {
      send: (_c: string, p: unknown) => sent.push(p as StreamEvent),
    };
    const connections = new Map<string, ConnectionHandle>();
    const job: ConnectJob = {
      jobId: "c1",
      config: {
        protocol: "websocket",
        ws: {
          url: "ws://x",
          headers: [],
          subprotocols: [],
          settings: {
            followRedirects: true,
            maxRedirects: 5,
            timeoutMs: 10000,
            sslVerify: true,
          },
        },
      },
      variableScopes: {
        global: {},
        collection: {},
        environment: {},
        local: {},
      },
    };

    connectToSender(job, sender, connections);
    expect(sent.find((e) => e.kind === "open")).toBeDefined();
    expect(connections.has("c1")).toBe(true);

    connections.get("c1")?.send({ event: "", data: "hi" });
    const msg = sent.find((e) => e.kind === "message");
    expect((msg?.payload as { data: string }).data).toBe("hi");

    connections.get("c1")?.close();
    expect(sent.find((e) => e.kind === "closed")).toBeDefined();
    expect(emitRef).toBeDefined();

    // REQUEST_CHANNEL 引用仅供类型完整性校验; 值本身不参与断言.
    void REQUEST_CHANNEL;
  });
});
