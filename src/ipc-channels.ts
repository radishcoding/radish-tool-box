import type {
  ConnectJob,
  ExecuteJob,
  GrpcReflectResult,
  OutboundMessage,
  ProtoSource,
  StreamEvent,
} from "./network/request-channels";

/**
 * 主进程与渲染进程之间窗口控制相关的 IPC 通道名.
 */
export const WINDOW_CHANNEL = {
  MINIMIZE: "window:minimize",
  TOGGLE_MAXIMIZE: "window:toggle-maximize",
  CLOSE: "window:close",
  IS_MAXIMIZED: "window:is-maximized",
  MAXIMIZE_CHANGE: "window:maximize-change",
  POPOUT: "window:popout",
  GET_POPOUT_SNAPSHOT: "window:get-popout-snapshot",
} as const;

/**
 * 经 contextBridge 暴露给渲染进程的窗口控制 API.
 */
export interface WindowControlsApi {
  readonly minimize: () => void;
  readonly toggleMaximize: () => void;
  readonly close: () => void;
  readonly isMaximized: () => Promise<boolean>;
  readonly onMaximizeChange: (
    callback: (maximized: boolean) => void,
  ) => () => void;
  readonly popout: (snapshot: PersistedSession) => void;
  readonly getPopoutSnapshot: () => Promise<PersistedSession | undefined>;
}

/**
 * 文件与持久化相关的 IPC 通道名.
 */
export const FILE_CHANNEL = {
  OPEN: "file:open",
  OPEN_PATH: "file:open-path",
  SAVE_FILE: "file:save-file",
  READ: "file:read",
  GET_RECENT: "file:get-recent",
  LOAD_SESSION: "session:load",
  SAVE_SESSION: "session:save",
  LOAD_CRYPTO: "crypto:load",
  SAVE_CRYPTO: "crypto:save",
  LOAD_ENCODING: "encoding:load",
  SAVE_ENCODING: "encoding:save",
  LOAD_CODEC: "codec:load",
  SAVE_CODEC: "codec:save",
  LOAD_JWT: "jwt:load",
  SAVE_JWT: "jwt:save",
  LOAD_REQUEST: "request-state:load",
  SAVE_REQUEST: "request-state:save",
} as const;

/**
 * 打开的文件: 绝对路径, 文件名, 文本内容.
 */
export interface OpenedFile {
  readonly path: string;
  readonly name: string;
  readonly content: string;
}

/**
 * 文件选择对话框的类型过滤器.
 */
export interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

/**
 * 保存文件的参数: 默认文件名与 base64 编码的字节内容.
 */
export interface SaveFileOptions {
  readonly defaultName: string;
  readonly base64: string;
}

/**
 * 持久化的单个文档.
 */
export interface PersistedDocument {
  readonly title: string;
  readonly text: string;
  readonly viewMode: "tree" | "raw";
  readonly selectedKey: string | undefined;
  readonly expanded: readonly string[];
}

/**
 * 持久化的会话.
 */
export interface PersistedSession {
  readonly documents: readonly PersistedDocument[];
  readonly activeIndex: number;
  readonly pathFormat: "js" | "jsonpath" | "pointer";
  /** 路径是否带 `//` 前缀; 旧会话可能缺省. */
  readonly pathPrefix?: boolean;
}

/**
 * 经 contextBridge 暴露给渲染进程的文件与持久化 API.
 */
export interface FileApi {
  readonly open: () => Promise<OpenedFile | undefined>;
  /** 打开文件选择框, 仅返回所选文件绝对路径 (不读内容); 取消返回 undefined. */
  readonly openPath: (
    filters?: readonly FileFilter[],
  ) => Promise<string | undefined>;
  /** 打开保存对话框并写入字节; 保存成功返回 true, 取消返回 false. */
  readonly saveFile: (options: SaveFileOptions) => Promise<boolean>;
  readonly read: (filePath: string) => Promise<OpenedFile | undefined>;
  readonly getRecent: () => Promise<readonly string[]>;
  readonly loadSession: () => Promise<PersistedSession | undefined>;
  readonly saveSession: (session: PersistedSession) => Promise<void>;
  /** 加载算法调试工具的持久状态 (不透明 JSON, 由渲染层解释). */
  readonly loadCryptoState: () => Promise<unknown>;
  /** 保存算法调试工具的持久状态. */
  readonly saveCryptoState: (state: unknown) => Promise<void>;
  /** 加载编码转换工具的持久状态 (不透明 JSON, 由渲染层解释). */
  readonly loadEncodingState: () => Promise<unknown>;
  /** 保存编码转换工具的持久状态. */
  readonly saveEncodingState: (state: unknown) => Promise<void>;
  /** 加载编码解码工具的持久状态 (不透明 JSON, 由渲染层解释). */
  readonly loadCodecState: () => Promise<unknown>;
  /** 保存编码解码工具的持久状态. */
  readonly saveCodecState: (state: unknown) => Promise<void>;
  /** 加载令牌调试工具的持久状态 (不含密钥). */
  readonly loadJwtState: () => Promise<unknown>;
  /** 保存令牌调试工具的持久状态. */
  readonly saveJwtState: (state: unknown) => Promise<void>;
  /** 加载请求调试工具的持久状态. */
  readonly loadRequestState: () => Promise<unknown>;
  /** 保存请求调试工具的持久状态. */
  readonly saveRequestState: (state: unknown) => Promise<void>;
}

/**
 * 经 contextBridge 暴露给渲染进程的请求调试 API.
 */
export interface NetworkApi {
  readonly execute: (job: ExecuteJob) => Promise<void>;
  readonly cancel: (jobId: string) => void;
  readonly onEvent: (callback: (event: StreamEvent) => void) => () => void;
  readonly connect: (job: ConnectJob) => void;
  readonly sendMessage: (jobId: string, message: OutboundMessage) => void;
  readonly disconnect: (jobId: string) => void;
  readonly grpcReflect: (source: ProtoSource) => Promise<GrpcReflectResult>;
}
