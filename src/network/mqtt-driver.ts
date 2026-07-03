import { connect, type MqttClient } from "mqtt";

import type { ConnectionHandle } from "./network-ipc";
import type {
  ConnectionConfig,
  DriverEvent,
  MqttSubscription,
} from "./request-channels";
import { buildTlsOptions } from "./tls-options";

/**
 * 建立一个 MQTT 连接, 订阅配置主题并收发消息以事件回传.
 * @param config 连接配置 (protocol 必为 mqtt).
 * @param onEvent 事件回调.
 * @returns 连接句柄.
 */
export function connectMqtt(
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
): ConnectionHandle {
  if (config.protocol !== "mqtt") {
    onEvent({ kind: "error", payload: { message: "协议不匹配" } });
    return { send: () => undefined, close: () => undefined };
  }
  const { url, clientId, username, password, subscriptions, settings } =
    config.mqtt;
  let client: MqttClient | undefined;
  let closedEarly = false;
  let ended = false;

  const emitClosed = (): void => {
    if (!ended) {
      ended = true;
      onEvent({ kind: "closed", payload: { code: 0, reason: "已断开" } });
    }
  };

  void (async (): Promise<void> => {
    let tls: Awaited<ReturnType<typeof buildTlsOptions>>;
    try {
      // 仅 mqtts/wss 需要 TLS; mqtt:// 也读取但无害 (mqtt.js 仅在安全协议下应用).
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
    client = connect(url, {
      clientId: clientId !== "" ? clientId : undefined,
      username: username !== "" ? username : undefined,
      password: password !== "" ? password : undefined,
      reconnectPeriod: 0,
      connectTimeout: settings.timeoutMs,
      // ISecureClientOptions 接受 Buffer; TlsOptions 字段类型兼容.
      ca: tls.ca,
      cert: tls.cert,
      key: tls.key,
      rejectUnauthorized: tls.rejectUnauthorized,
    });

    client.on("connect", () => {
      // 先订阅所有非空主题, 等全部 subscribe 回调确认后再 emit open,
      // 保证调用方在 open 后 send 时订阅已在 broker 端生效.
      const topics = subscriptions.filter((s) => s.topic !== "");
      if (topics.length === 0) {
        onEvent({ kind: "open", payload: { info: "已连接" } });
        return;
      }
      let pending = topics.length;
      for (const sub of topics) {
        client?.subscribe(sub.topic, { qos: sub.qos }, (err: Error | null) => {
          // 订阅失败不阻断连接, 但以系统消息提示, 避免静默吞掉 broker 拒绝.
          if (err !== null) {
            onEvent({
              kind: "message",
              payload: {
                direction: "system",
                event: sub.topic,
                data: `订阅失败: ${err.message}`,
              },
            });
          }
          pending -= 1;
          if (pending === 0) {
            onEvent({ kind: "open", payload: { info: "已连接" } });
          }
        });
      }
    });

    client.on("message", (topic: string, payload: Buffer) => {
      onEvent({
        kind: "message",
        payload: {
          direction: "received",
          event: topic,
          data: payload.toString("utf8"),
          size: payload.length,
        },
      });
    });

    client.on("error", (err: Error) => {
      // closedEarly 时 end(true) 可能触发 error, 静默忽略.
      if (!closedEarly) {
        onEvent({ kind: "error", payload: { message: err.message } });
      }
    });

    // close 事件在连接断开后触发, 触发 emitClosed (幂等).
    client.on("close", emitClosed);
  })();

  return {
    send: (message) => {
      // event 充当发布主题; 空主题忽略.
      if (client !== undefined && message.event !== "") {
        client.publish(message.event, message.data, {
          qos: message.qos ?? 0,
        });
      }
    },
    close: () => {
      closedEarly = true;
      if (client !== undefined) {
        client.end(true, () => emitClosed());
      } else {
        emitClosed();
      }
    },
  };
}

/**
 * 一条订阅的类型别名 (供测试与编辑器引用).
 */
export type { MqttSubscription };
