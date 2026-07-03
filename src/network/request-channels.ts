/**
 * 请求调试主/渲染之间的 IPC 通道名.
 */
export const REQUEST_CHANNEL = {
  EXECUTE: "request:execute",
  EVENT: "request:event",
  CANCEL: "request:cancel",
  CONNECT: "request:connect",
  SEND: "request:send",
  DISCONNECT: "request:disconnect",
  GRPC_REFLECT: "request:grpc-reflect",
} as const;

/**
 * HTTP 方法; 允许自定义动词 (字符串字面量并入 string).
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | string;

/**
 * 通用键值项 (头/参数/表单/变量复用).
 */
export interface KeyValueItem {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly enabled: boolean;
  readonly description?: string;
  readonly kind?: "text" | "file" | "secret";
}

/**
 * 客户端证书 (mTLS), 私钥按文件路径引用.
 */
export interface ClientCert {
  readonly certPath: string;
  readonly keyPath: string;
  readonly passphrase?: string;
}

/**
 * 逐请求设置 (本阶段子集).
 */
export interface RequestSettings {
  readonly followRedirects: boolean;
  readonly maxRedirects: number;
  readonly timeoutMs: number;
  readonly sslVerify: boolean;
  readonly customCaPath?: string;
  readonly clientCert?: ClientCert;
  readonly tlsMinVersion?: string;
  readonly tlsMaxVersion?: string;
  readonly sni?: string;
}

/**
 * 一次 HTTP 请求规格 (本阶段; body 仅字符串).
 */
export interface HttpRequestSpec {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: readonly KeyValueItem[];
  readonly body?: string | Buffer;
  readonly cleanMode: boolean;
  readonly settings: RequestSettings;
}

/**
 * 四级变量作用域快照.
 */
export interface VariableScopes {
  readonly global: Readonly<Record<string, string>>;
  readonly collection: Readonly<Record<string, string>>;
  readonly environment: Readonly<Record<string, string>>;
  readonly local: Readonly<Record<string, string>>;
}

/**
 * 自包含的执行作业.
 */
export interface ExecuteJob {
  readonly jobId: string;
  readonly spec: HttpRequest;
  readonly variableScopes: VariableScopes;
}

/**
 * 驱动层事件种类.
 */
export type DriverEventKind =
  | "status"
  | "headers"
  | "chunk"
  | "metric"
  | "cookie"
  | "test"
  | "log"
  | "vars"
  | "open"
  | "message"
  | "closed"
  | "end"
  | "error";

/**
 * 驱动层事件 (不含 jobId).
 */
export interface DriverEvent {
  readonly kind: DriverEventKind;
  readonly payload: unknown;
}

/**
 * 回传渲染层的流式事件 (带 jobId).
 */
export interface StreamEvent extends DriverEvent {
  readonly jobId: string;
}

/**
 * 鉴权配置 (判别联合; 本阶段实现 7 种, inherit 留后续).
 */
export type AuthConfig =
  | { readonly type: "none" }
  | {
      readonly type: "basic";
      readonly username: string;
      readonly password: string;
    }
  | { readonly type: "bearer"; readonly token: string }
  | {
      readonly type: "apikey";
      readonly key: string;
      readonly value: string;
      readonly addTo: "header" | "query";
    }
  | {
      readonly type: "digest";
      readonly username: string;
      readonly password: string;
    }
  | {
      readonly type: "oauth2";
      readonly grant: "token" | "client_credentials";
      readonly accessToken: string;
      readonly tokenUrl: string;
      readonly clientId: string;
      readonly clientSecret: string;
      readonly scope: string;
      readonly headerPrefix: string;
    }
  | {
      readonly type: "awsv4";
      readonly accessKeyId: string;
      readonly secretAccessKey: string;
      readonly region: string;
      readonly service: string;
      readonly sessionToken: string;
    };

/**
 * raw 请求体的子类型.
 */
export type RawType = "json" | "xml" | "text" | "html" | "javascript";

/**
 * multipart/form-data 的单项 (文本或文件).
 */
export interface FormDataItem {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly enabled: boolean;
  readonly kind: "text" | "file";
  readonly filename?: string;
  readonly contentType?: string;
}

/**
 * 请求体配置 (判别联合).
 */
export type BodyConfig =
  | { readonly type: "none" }
  | { readonly type: "raw"; readonly rawType: RawType; readonly text: string }
  | { readonly type: "urlencoded"; readonly items: readonly KeyValueItem[] }
  | { readonly type: "formdata"; readonly items: readonly FormDataItem[] }
  | { readonly type: "binary"; readonly filePath: string }
  | {
      readonly type: "graphql";
      readonly query: string;
      readonly variables: string;
    };

/**
 * 高层 HTTP 请求 (渲染层编辑/作业下发的形态; 由 pipeline 解析为驱动层 spec).
 */
export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly params: readonly KeyValueItem[];
  readonly headers: readonly KeyValueItem[];
  readonly cleanMode: boolean;
  readonly auth: AuthConfig;
  readonly body: BodyConfig;
  readonly settings: RequestSettings;
  readonly preScript: string;
  readonly postScript: string;
}

/**
 * 脚本对某作用域变量的一次改动.
 */
export interface ScriptMutation {
  readonly scope: "globals" | "collection" | "environment" | "local";
  readonly action: "set" | "unset";
  readonly key: string;
  readonly value: string;
}

/**
 * 一条断言 (pm.test) 的结果.
 */
export interface TestResult {
  readonly name: string;
  readonly passed: boolean;
  readonly error: string;
}

/**
 * 协议种类.
 */
export type Protocol =
  | "http"
  | "websocket"
  | "socketio"
  | "sse"
  | "tcp"
  | "mqtt"
  | "grpc";

/**
 * WebSocket 连接配置.
 */
export interface WsConfig {
  readonly url: string;
  readonly headers: readonly KeyValueItem[];
  readonly subprotocols: readonly string[];
  readonly settings: RequestSettings;
}

/**
 * Socket.IO 连接配置.
 */
export interface SocketIoConfig {
  readonly url: string;
  readonly headers: readonly KeyValueItem[];
  readonly namespace: string;
  readonly settings: RequestSettings;
}

/**
 * SSE 连接配置.
 */
export interface SseConfig {
  readonly url: string;
  readonly headers: readonly KeyValueItem[];
  readonly settings: RequestSettings;
}

/**
 * TCP 原始连接配置.
 */
export interface TcpConfig {
  readonly host: string;
  readonly port: number;
  readonly tls: boolean;
  readonly settings: RequestSettings;
}

/**
 * 一条 MQTT 订阅 (主题 + QoS).
 */
export interface MqttSubscription {
  readonly topic: string;
  readonly qos: 0 | 1 | 2;
}

/**
 * MQTT 连接配置.
 */
export interface MqttConfig {
  readonly url: string;
  readonly clientId: string;
  readonly username: string;
  readonly password: string;
  readonly subscriptions: readonly MqttSubscription[];
  readonly settings: RequestSettings;
}

/**
 * 客户端流/双向流 "结束发送" 哨兵: OutboundMessage.event 等于此值时驱动半关闭请求流.
 */
export const GRPC_END_SENTINEL = "__grpc_end__";

/**
 * gRPC 调用配置.
 */
export interface GrpcConfig {
  readonly protoSource: ProtoSource;
  readonly target: string;
  readonly tls: boolean;
  readonly serviceName: string;
  readonly methodName: string;
  readonly metadata: readonly KeyValueItem[];
  readonly requestMessage: string;
  readonly settings: RequestSettings;
}

/**
 * 连接配置 (按协议判别).
 */
export type ConnectionConfig =
  | { readonly protocol: "websocket"; readonly ws: WsConfig }
  | { readonly protocol: "socketio"; readonly socketio: SocketIoConfig }
  | { readonly protocol: "sse"; readonly sse: SseConfig }
  | { readonly protocol: "tcp"; readonly tcp: TcpConfig }
  | { readonly protocol: "mqtt"; readonly mqtt: MqttConfig }
  | { readonly protocol: "grpc"; readonly grpc: GrpcConfig };

/**
 * 建立连接的作业.
 */
export interface ConnectJob {
  readonly jobId: string;
  readonly config: ConnectionConfig;
  readonly variableScopes: VariableScopes;
}

/**
 * proto 来源: 文件路径或粘贴文本.
 */
export type ProtoSource =
  | { readonly kind: "file"; readonly value: string }
  | { readonly kind: "text"; readonly value: string };

/**
 * 一个 gRPC 方法的自省信息.
 */
export interface GrpcMethodInfo {
  readonly name: string;
  readonly requestStream: boolean;
  readonly responseStream: boolean;
}

/**
 * 一个 gRPC 服务的自省信息 (全限定名 + 方法列表).
 */
export interface GrpcServiceInfo {
  readonly name: string;
  readonly methods: readonly GrpcMethodInfo[];
}

/**
 * proto 自省结果.
 */
export interface GrpcReflectResult {
  readonly ok: boolean;
  readonly services: readonly GrpcServiceInfo[];
  readonly error: string;
}

/**
 * 向连接发送的消息 (event 仅 Socket.IO 用).
 */
export interface OutboundMessage {
  readonly event: string;
  readonly data: string;
  // 原始字节协议 (TCP) 据此把 data 解释为文本或 Hex; 其它协议忽略, 按文本处理.
  readonly format?: "text" | "hex";
  // MQTT 发布的 QoS 等级; 其它协议忽略.
  readonly qos?: 0 | 1 | 2;
}
