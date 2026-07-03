import { io, type Socket } from "socket.io-client";

import type { ConnectionHandle } from "./network-ipc";
import type {
  ConnectionConfig,
  DriverEvent,
  KeyValueItem,
} from "./request-channels";
import { buildTlsOptions, type TlsOptions } from "./tls-options";

/**
 * 把启用的键值头组装为 extraHeaders.
 * @param items 头项.
 * @returns 头对象.
 */
function toHeaders(items: readonly KeyValueItem[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const it of items) {
    if (it.enabled && it.key !== "") {
      headers[it.key] = it.value;
    }
  }
  return headers;
}

/**
 * 尝试把消息 data 解析为 JSON (供 emit 传结构化负载); 失败则原样字符串.
 * @param data 消息文本.
 * @returns 解析后的值.
 */
function parsePayload(data: string): unknown {
  if (data.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/**
 * 安全 JSON 序列化 (供消息展示).
 * @param value 任意值.
 * @returns 字符串.
 */
function safeJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 把 TLS 选项映射为 socket.io-client 透传给底层传输的字段.
 * socket.io-client 的 ManagerOptions 不声明 TLS 字段, 但底层 engine.io ws 传输接受并透传.
 * 以 Record<string, unknown> 返回后受控收窄合并至 io() 参数.
 * @param tls TLS 选项.
 * @returns 选项片段.
 */
function tlsToIoOptions(tls: TlsOptions): Record<string, unknown> {
  return {
    rejectUnauthorized: tls.rejectUnauthorized,
    ca: tls.ca,
    cert: tls.cert,
    key: tls.key,
    passphrase: tls.passphrase,
    servername: tls.servername,
  };
}

/**
 * 建立一个 Socket.IO 连接 (异步读取 TLS 证书后构造), emit/监听事件以消息回传.
 * 句柄同步返回; 内部异步 IIFE 完成 buildTlsOptions 后再构造 socket.
 * 若调用方在握手前调用 close(), closedEarly 守卫确保不构造 socket.
 * @param config 连接配置 (protocol 必为 socketio).
 * @param onEvent 事件回调.
 * @returns 连接句柄 (send 按 message.event 名 emit).
 */
export function connectSocketIo(
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
): ConnectionHandle {
  if (config.protocol !== "socketio") {
    onEvent({ kind: "error", payload: { message: "协议不匹配" } });
    return { send: () => undefined, close: () => undefined };
  }
  const { url, headers, namespace, settings } = config.socketio;
  const target = namespace !== "" ? `${url}${namespace}` : url;
  let socket: Socket | undefined;
  let closedEarly = false;

  void (async (): Promise<void> => {
    let tls: TlsOptions;
    try {
      tls = await buildTlsOptions(settings);
    } catch (err) {
      onEvent({
        kind: "error",
        payload: { message: err instanceof Error ? err.message : String(err) },
      });
      return;
    }
    if (closedEarly) {
      return;
    }
    // socket.io-client ManagerOptions 不含 TLS 字段, 受控收窄合并以透传至底层传输.
    const baseOptions = {
      extraHeaders: toHeaders(headers),
      timeout: settings.timeoutMs,
      reconnection: false,
      transports: ["websocket", "polling"],
    };
    socket = io(target, {
      ...baseOptions,
      ...tlsToIoOptions(tls),
    } as Parameters<typeof io>[1]);

    socket.on("connect", () =>
      onEvent({ kind: "open", payload: { info: "已连接" } }),
    );
    socket.onAny((event: string, ...args: unknown[]) => {
      onEvent({
        kind: "message",
        payload: {
          direction: "received",
          event,
          data: args.length === 1 ? safeJson(args[0]) : safeJson(args),
        },
      });
    });
    socket.on("disconnect", (reason: string) =>
      onEvent({ kind: "closed", payload: { code: 0, reason } }),
    );
    socket.on("connect_error", (err: Error) =>
      onEvent({ kind: "error", payload: { message: err.message } }),
    );
  })();

  return {
    send: (message) => {
      socket?.emit(
        message.event === "" ? "message" : message.event,
        parsePayload(message.data),
      );
    },
    close: () => {
      closedEarly = true;
      // socket 已建则 disconnect 触发 closed 事件; 未建 (握手前断开) 则自发 closed, 否则渲染层卡在连接中.
      if (socket !== undefined) {
        socket.disconnect();
      } else {
        onEvent({ kind: "closed", payload: { code: 0, reason: "已断开" } });
      }
    },
  };
}
