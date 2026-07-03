import { connect as netConnect, type Socket } from "node:net";
import type { ConnectionOptions as TlsConnectionOptions } from "node:tls";
import { connect as tlsConnect } from "node:tls";

import type { ConnectionHandle } from "./network-ipc";
import type {
  ConnectionConfig,
  DriverEvent,
  OutboundMessage,
} from "./request-channels";
import { buildTlsOptions } from "./tls-options";

/**
 * 把一条出站消息按 format 解码为字节缓冲.
 * @param message 出站消息.
 * @returns 字节缓冲 (Hex 非法时回退按文本编码, 避免静默丢数据).
 */
function encodeOutbound(message: OutboundMessage): Buffer {
  if (message.format === "hex") {
    const hex = message.data.replace(/[\s:]/g, "");
    if (/^[0-9a-fA-F]*$/.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, "hex");
    }
    // Hex 格式非法: 回退为 UTF-8 文本, 不静默丢弃.
    return Buffer.from(message.data, "utf8");
  }
  return Buffer.from(message.data, "utf8");
}

/**
 * 建立一个 TCP 原始连接 (可选 TLS), 收发原始字节以事件回传.
 * 句柄同步返回; 内部异步 IIFE 完成 TLS 选项构建后再建立 socket.
 * 若调用方在连接前调用 close(), closedEarly 守卫确保不构造 socket 并自发 closed 事件.
 * @param config 连接配置 (protocol 必为 tcp).
 * @param onEvent 事件回调.
 * @returns 连接句柄.
 */
export function connectTcp(
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
): ConnectionHandle {
  if (config.protocol !== "tcp") {
    onEvent({ kind: "error", payload: { message: "协议不匹配" } });
    return { send: () => undefined, close: () => undefined };
  }
  const { host, port, tls, settings } = config.tcp;
  let socket: Socket | undefined;
  let closedEarly = false;
  let ended = false;

  /** 幂等地发出 closed 事件, 避免 close/error 多次触发. */
  const emitClosed = (): void => {
    if (!ended) {
      ended = true;
      onEvent({ kind: "closed", payload: { code: 0, reason: "已断开" } });
    }
  };

  /**
   * 绑定 socket 的 data/error/close 监听器.
   * @param s 已构造的 socket.
   */
  const wire = (s: Socket): void => {
    s.on("data", (data: Buffer) =>
      onEvent({
        kind: "message",
        payload: {
          direction: "received",
          event: "",
          data: data.toString("utf8"),
          size: data.length,
        },
      }),
    );
    s.on("error", (err: Error) => {
      if (!closedEarly) {
        onEvent({ kind: "error", payload: { message: err.message } });
      }
    });
    s.on("close", emitClosed);
  };

  void (async (): Promise<void> => {
    try {
      if (tls) {
        const tlsOpts = await buildTlsOptions(settings);
        if (closedEarly) {
          return;
        }
        // minVersion/maxVersion: TlsOptions 持 string, node:tls 期望 SecureVersion 联合; 受控收窄.
        const tlsConnectOpts: TlsConnectionOptions = {
          host,
          port,
          rejectUnauthorized: tlsOpts.rejectUnauthorized,
          ca: tlsOpts.ca,
          cert: tlsOpts.cert,
          key: tlsOpts.key,
          passphrase: tlsOpts.passphrase,
          minVersion: tlsOpts.minVersion as TlsConnectionOptions["minVersion"],
          maxVersion: tlsOpts.maxVersion as TlsConnectionOptions["maxVersion"],
          servername: tlsOpts.servername ?? host,
        };
        socket = tlsConnect(tlsConnectOpts, () =>
          onEvent({ kind: "open", payload: { info: "已连接 (TLS)" } }),
        );
      } else {
        if (closedEarly) {
          return;
        }
        socket = netConnect({ host, port }, () =>
          onEvent({ kind: "open", payload: { info: "已连接" } }),
        );
      }
      wire(socket);
    } catch (err) {
      onEvent({
        kind: "error",
        payload: { message: err instanceof Error ? err.message : String(err) },
      });
    }
  })();

  return {
    send: (message) => {
      socket?.write(encodeOutbound(message));
    },
    close: () => {
      closedEarly = true;
      if (socket !== undefined) {
        socket.destroy();
      } else {
        emitClosed();
      }
    },
  };
}
