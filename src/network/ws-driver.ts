import WebSocket from "ws";

import type { ConnectionHandle } from "./network-ipc";
import type {
  ConnectionConfig,
  DriverEvent,
  KeyValueItem,
} from "./request-channels";
import { buildTlsOptions, type TlsOptions } from "./tls-options";

/**
 * 把启用的键值头组装为 ws 头对象.
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
 * ws 构造函数第三参数的类型别名 (ClientOptions | ClientRequestArgs).
 * ClientRequestArgs 继承 tls.ConnectionOptions, 含 servername/minVersion/maxVersion.
 */
type WsCtorOptions = NonNullable<ConstructorParameters<typeof WebSocket>[2]>;

/**
 * 把 TLS 选项映射为 ws 构造函数选项片段.
 * servername 存在于 ClientRequestArgs (继承 tls.ConnectionOptions) 而非 ClientOptions;
 * 整体以受控收窄 (as WsCtorOptions) 合并, 不使用 as any.
 * @param tls TLS 选项.
 * @returns ws 构造函数选项片段.
 */
function tlsToWsOptions(tls: TlsOptions): WsCtorOptions {
  const opts = {
    rejectUnauthorized: tls.rejectUnauthorized,
    ca: tls.ca,
    cert: tls.cert,
    key: tls.key,
    passphrase: tls.passphrase,
    // minVersion/maxVersion: TlsOptions 持 string, ws/tls 期望 SecureVersion 联合; 受控收窄.
    minVersion: tls.minVersion as WebSocket.ClientOptions["minVersion"],
    maxVersion: tls.maxVersion as WebSocket.ClientOptions["maxVersion"],
    // servername 在 tls.ConnectionOptions (ClientRequestArgs 侧), 受控收窄合并.
    servername: tls.servername,
  };
  return opts as WsCtorOptions;
}

/**
 * 建立一个 WebSocket 连接 (异步读取 TLS 证书后构造), 收发消息以事件回传.
 * 句柄同步返回; 内部异步 IIFE 完成 buildTlsOptions 后再构造 socket.
 * 若调用方在握手前调用 close(), closedEarly 守卫确保不构造 socket 并自发 closed 事件.
 * @param config 连接配置 (protocol 必为 websocket).
 * @param onEvent 事件回调.
 * @returns 连接句柄.
 */
export function connectWs(
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
): ConnectionHandle {
  if (config.protocol !== "websocket") {
    onEvent({ kind: "error", payload: { message: "协议不匹配" } });
    return { send: () => undefined, close: () => undefined };
  }
  const { url, headers, subprotocols, settings } = config.ws;
  let socket: WebSocket | undefined;
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
    // 合并基础选项与 TLS 选项, 整体受控收窄为构造函数第三参数类型.
    const wsOptions: WsCtorOptions = {
      headers: toHeaders(headers),
      handshakeTimeout: settings.timeoutMs,
      ...tlsToWsOptions(tls),
    } as WsCtorOptions;
    socket = new WebSocket(url, [...subprotocols], wsOptions);
    socket.on("open", () => {
      onEvent({ kind: "open", payload: { info: "已连接" } });
      // 上报握手协商到的子协议 (空表示未协商), 便于验证子协议功能.
      const negotiated = socket?.protocol ?? "";
      if (negotiated !== "") {
        onEvent({
          kind: "message",
          payload: {
            direction: "system",
            event: "",
            data: `已协商子协议: ${negotiated}`,
          },
        });
      }
    });
    socket.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
      onEvent({
        kind: "message",
        payload: {
          direction: "received",
          event: "",
          data: isBinary
            ? `[二进制 ${(data as Buffer).length} 字节] ${(data as Buffer).toString("base64")}`
            : data.toString(),
        },
      });
    });
    socket.on("close", (code: number, reason: Buffer) =>
      onEvent({ kind: "closed", payload: { code, reason: reason.toString() } }),
    );
    socket.on("error", (err: Error) =>
      onEvent({ kind: "error", payload: { message: err.message } }),
    );
  })();

  return {
    send: (message) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(message.data);
      }
    },
    close: () => {
      closedEarly = true;
      if (socket !== undefined) {
        socket.close();
      } else {
        onEvent({ kind: "closed", payload: { code: 0, reason: "已断开" } });
      }
    },
  };
}
