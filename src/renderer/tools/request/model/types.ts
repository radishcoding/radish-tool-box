export type {
  AuthConfig,
  BodyConfig,
  ClientCert,
  ConnectionConfig,
  ExecuteJob,
  FormDataItem,
  GrpcConfig,
  GrpcMethodInfo,
  GrpcReflectResult,
  GrpcServiceInfo,
  HttpMethod,
  HttpRequest,
  KeyValueItem,
  MqttConfig,
  MqttSubscription,
  OutboundMessage,
  Protocol,
  ProtoSource,
  RawType,
  RequestSettings,
  ScriptMutation,
  SocketIoConfig,
  SseConfig,
  StreamEvent,
  TcpConfig,
  TestResult,
  WsConfig,
} from "../../../../network/request-channels";

export type {
  CollectionFolder,
  CollectionNode,
  CollectionRequestNode,
} from "./collection-tree";

import type { CollectionNode } from "./collection-tree";
import type {
  GrpcConfig,
  GrpcServiceInfo,
  HttpMethod,
  HttpRequest,
  KeyValueItem,
  MqttConfig,
  Protocol,
  ProtoSource,
  SocketIoConfig,
  SseConfig,
  TcpConfig,
  TestResult,
  WsConfig,
} from "../../../../network/request-channels";

/**
 * 左侧栏的分区.
 */
export type SidebarSection = "collections" | "history" | "environments";

/**
 * 一个打开的请求标签 (持有高层请求草稿).
 */
export interface RequestTab {
  readonly id: string;
  readonly name: string;
  readonly request: HttpRequest;
  readonly dirty: boolean;
  readonly collectionId?: string;
  readonly nodeId?: string;
  readonly protocol: Protocol;
  readonly ws?: WsConfig;
  readonly socketio?: SocketIoConfig;
  readonly sse?: SseConfig;
  readonly tcp?: TcpConfig;
  readonly mqtt?: MqttConfig;
  readonly grpc?: GrpcConfig;
  readonly grpcServices?: readonly GrpcServiceInfo[];
}

/**
 * 请求调试板块的持久化状态.
 */
export interface PersistedRequestState {
  readonly tabs: readonly RequestTab[];
  readonly activeTabId: string | undefined;
  readonly sidebarSection: SidebarSection;
  readonly collections: readonly Collection[];
  readonly environments: readonly Environment[];
  readonly globals: readonly KeyValueItem[];
  readonly activeEnvironmentId: string | undefined;
  readonly history: readonly HistoryEntry[];
}

/**
 * 请求逐项设置的默认值.
 */
const DEFAULT_SETTINGS: HttpRequest["settings"] = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 30000,
  sslVerify: true,
};

/**
 * 构造一个默认的空白 HTTP 请求 (GET, 无鉴权, 无体).
 * @returns 默认高层请求.
 */
export function createDefaultRequest(): HttpRequest {
  return {
    method: "GET",
    url: "",
    params: [],
    headers: [],
    cleanMode: false,
    auth: { type: "none" },
    body: { type: "none" },
    settings: DEFAULT_SETTINGS,
    preScript: "",
    postScript: "",
  };
}

/**
 * 响应的阶段.
 */
export type ResponsePhase = "idle" | "running" | "done" | "error" | "cancelled";

/**
 * 单个标签的流式响应状态 (非持久化).
 */
export interface ResponseState {
  readonly phase: ResponsePhase;
  readonly jobId: string;
  // 本次请求的 URL (供 Preview 注入 <base> 让相对资源解析).
  readonly url: string;
  readonly statusCode: number;
  readonly statusText: string;
  readonly httpVersion: string;
  readonly headers: Record<string, string | string[]>;
  readonly chunks: readonly string[];
  // 整条重定向链累积的原始 Set-Cookie 行 (含被跟随的中间跳设置的 cookie).
  readonly cookies: readonly string[];
  // 最终跳实际发送的 Cookie 请求头 (从 Cookie Jar 带出的 cookie; 空串表示未带).
  readonly sentCookie: string;
  readonly timeMs: number;
  readonly error: string;
  readonly tests: readonly TestResult[];
  readonly logs: readonly string[];
}

/**
 * 一个集合 (含集合级变量与嵌套节点树).
 */
export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly variables: readonly KeyValueItem[];
  readonly nodes: readonly CollectionNode[];
}

/**
 * 一个环境 (含一组变量).
 */
export interface Environment {
  readonly id: string;
  readonly name: string;
  readonly variables: readonly KeyValueItem[];
}

/**
 * 一条历史记录 (请求快照 + 结果状态).
 */
export interface HistoryEntry {
  readonly id: string;
  readonly ts: number;
  readonly method: HttpMethod;
  readonly url: string;
  readonly request: HttpRequest;
  readonly statusCode: number;
}

/**
 * 连接默认设置.
 */
const DEFAULT_CONN_SETTINGS: WsConfig["settings"] = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 30000,
  sslVerify: true,
};

/**
 * 构造默认 WebSocket 配置.
 * @returns ws 配置.
 */
export function createDefaultWsConfig(): WsConfig {
  return {
    url: "",
    headers: [],
    subprotocols: [],
    settings: DEFAULT_CONN_SETTINGS,
  };
}

/**
 * 构造默认 Socket.IO 配置.
 * @returns socketio 配置.
 */
export function createDefaultSocketIoConfig(): SocketIoConfig {
  return {
    url: "",
    headers: [],
    namespace: "",
    settings: DEFAULT_CONN_SETTINGS,
  };
}

/**
 * 构造默认 SSE 配置.
 * @returns sse 配置.
 */
export function createDefaultSseConfig(): SseConfig {
  return { url: "", headers: [], settings: DEFAULT_CONN_SETTINGS };
}

/**
 * 构造默认 TCP 配置.
 * @returns tcp 配置.
 */
export function createDefaultTcpConfig(): TcpConfig {
  return { host: "", port: 0, tls: false, settings: DEFAULT_CONN_SETTINGS };
}

/**
 * 构造默认 MQTT 配置.
 * @returns mqtt 配置.
 */
export function createDefaultMqttConfig(): MqttConfig {
  return {
    url: "",
    clientId: "",
    username: "",
    password: "",
    subscriptions: [],
    settings: DEFAULT_CONN_SETTINGS,
  };
}

/**
 * 构造默认 gRPC 配置.
 * @returns grpc 配置.
 */
export function createDefaultGrpcConfig(): GrpcConfig {
  return {
    protoSource: { kind: "text", value: "" } satisfies ProtoSource,
    target: "",
    tls: false,
    serviceName: "",
    methodName: "",
    metadata: [],
    requestMessage: "{}",
    settings: DEFAULT_CONN_SETTINGS,
  };
}

/**
 * 连接状态阶段.
 */
export type ConnStatus = "idle" | "connecting" | "open" | "closed" | "error";

/**
 * 一条消息 (双向).
 */
export interface Message {
  readonly id: string;
  readonly direction: "sent" | "received" | "system";
  readonly time: number;
  readonly event: string;
  readonly data: string;
  readonly size?: number;
}

/**
 * 单个标签的连接状态 (非持久化).
 */
export interface ConnectionState {
  readonly status: ConnStatus;
  readonly jobId: string;
  readonly messages: readonly Message[];
  readonly error: string;
}
