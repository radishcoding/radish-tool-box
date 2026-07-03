import type {
  ConnectionConfig,
  KeyValueItem,
  VariableScopes,
} from "./request-channels";
import { flattenScopes, resolveTemplate } from "./variables";

/**
 * 解析一组键值头的值中的 {{var}} (键保持原样).
 * @param items 头项.
 * @param vars 扁平变量表.
 * @returns 解析后的头项.
 */
function resolveHeaders(
  items: readonly KeyValueItem[],
  vars: Readonly<Record<string, string>>,
): readonly KeyValueItem[] {
  return items.map((it) => ({ ...it, value: resolveTemplate(it.value, vars) }));
}

/**
 * 用变量作用域解析连接配置中的 URL/头/子协议/命名空间; 未知键原样保留.
 * 在主进程分发给驱动前调用, 使长连接与 HTTP 的变量行为一致.
 * @param config 原始连接配置.
 * @param scopes 四级变量作用域.
 * @returns 解析后的连接配置.
 */
export function resolveConnectionConfig(
  config: ConnectionConfig,
  scopes: VariableScopes,
): ConnectionConfig {
  const vars = flattenScopes(scopes);
  switch (config.protocol) {
    case "websocket":
      return {
        protocol: "websocket",
        ws: {
          ...config.ws,
          url: resolveTemplate(config.ws.url, vars),
          headers: resolveHeaders(config.ws.headers, vars),
          subprotocols: config.ws.subprotocols.map((s) =>
            resolveTemplate(s, vars),
          ),
        },
      };
    case "socketio":
      return {
        protocol: "socketio",
        socketio: {
          ...config.socketio,
          url: resolveTemplate(config.socketio.url, vars),
          headers: resolveHeaders(config.socketio.headers, vars),
          namespace: resolveTemplate(config.socketio.namespace, vars),
        },
      };
    case "sse":
      return {
        protocol: "sse",
        sse: {
          ...config.sse,
          url: resolveTemplate(config.sse.url, vars),
          headers: resolveHeaders(config.sse.headers, vars),
        },
      };
    case "tcp":
      return {
        protocol: "tcp",
        tcp: {
          ...config.tcp,
          host: resolveTemplate(config.tcp.host, vars),
        },
      };
    case "mqtt":
      return {
        protocol: "mqtt",
        mqtt: {
          ...config.mqtt,
          url: resolveTemplate(config.mqtt.url, vars),
          clientId: resolveTemplate(config.mqtt.clientId, vars),
          username: resolveTemplate(config.mqtt.username, vars),
          password: resolveTemplate(config.mqtt.password, vars),
          subscriptions: config.mqtt.subscriptions.map((s) => ({
            ...s,
            topic: resolveTemplate(s.topic, vars),
          })),
        },
      };
    case "grpc":
      return {
        protocol: "grpc",
        grpc: {
          ...config.grpc,
          target: resolveTemplate(config.grpc.target, vars),
          metadata: config.grpc.metadata.map((m) => ({
            ...m,
            value: resolveTemplate(m.value, vars),
          })),
          requestMessage: resolveTemplate(config.grpc.requestMessage, vars),
        },
      };
    default:
      return config;
  }
}
