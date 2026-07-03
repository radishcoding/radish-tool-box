import { create } from "zustand";

import type { ImportedCollection } from "../model/import/types";
import {
  findNode,
  insertNode,
  removeNode,
  renameNode as renameTreeNode,
  replaceRequest,
  type CollectionNode,
} from "../model/collection-tree";
import { applyParamsToUrl, parseQueryToParams } from "../model/query-sync";
import {
  createDefaultGrpcConfig,
  createDefaultMqttConfig,
  createDefaultRequest,
  createDefaultSocketIoConfig,
  createDefaultSseConfig,
  createDefaultTcpConfig,
  createDefaultWsConfig,
  type Collection,
  type ConnectionState,
  type Environment,
  type GrpcConfig,
  type GrpcServiceInfo,
  type HistoryEntry,
  type HttpRequest,
  type KeyValueItem,
  type Message,
  type MqttConfig,
  type MqttSubscription,
  type PersistedRequestState,
  type Protocol,
  type ProtoSource,
  type RequestSettings,
  type RequestTab,
  type ResponseState,
  type ScriptMutation,
  type SidebarSection,
  type StreamEvent,
  type TcpConfig,
  type TestResult,
} from "../model/types";

/**
 * 生成一个唯一 id (集合/环境/节点/历史通用).
 * @param prefix id 前缀.
 * @returns 唯一 id.
 */
function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * 历史环形上限.
 */
const HISTORY_LIMIT = 200;

/**
 * 把一次脚本变量改动应用到键值变量数组 (set 更新或新增, unset 删除).
 * @param items 当前变量.
 * @param mutation 改动.
 * @returns 新变量数组.
 */
function applyVarMutation(
  items: readonly KeyValueItem[],
  mutation: ScriptMutation,
): readonly KeyValueItem[] {
  if (mutation.action === "unset") {
    return items.filter((it) => it.key !== mutation.key);
  }
  const existing = items.find((it) => it.key === mutation.key);
  if (existing !== undefined) {
    return items.map((it) =>
      it.key === mutation.key ? { ...it, value: mutation.value } : it,
    );
  }
  return [
    ...items,
    {
      id: newId("var"),
      key: mutation.key,
      value: mutation.value,
      enabled: true,
    },
  ];
}

/**
 * 递归查找集合中的请求节点 (仅 request 类型).
 * @param nodes 节点列表.
 * @param id 目标节点 id.
 * @returns 命中的请求节点, 或 undefined.
 */
function findSavedNode(
  nodes: readonly CollectionNode[],
  id: string,
): Extract<CollectionNode, { type: "request" }> | undefined {
  for (const node of nodes) {
    if (node.id === id && node.type === "request") {
      return node;
    }
    if (node.type === "folder") {
      const found = findSavedNode(node.children, id);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * 把一个驱动事件应用到响应状态, 返回新状态.
 * @param current 当前响应.
 * @param event 流式事件.
 * @returns 更新后的响应.
 */
function applyEventToResponse(
  current: ResponseState,
  event: StreamEvent,
): ResponseState {
  switch (event.kind) {
    case "status": {
      const p = event.payload as {
        statusCode: number;
        statusText: string;
        httpVersion: string;
      };
      return {
        ...current,
        statusCode: p.statusCode,
        statusText: p.statusText,
        httpVersion: p.httpVersion,
      };
    }
    case "headers":
      return {
        ...current,
        headers: event.payload as Record<string, string | string[]>,
      };
    case "chunk":
      return {
        ...current,
        chunks: [
          ...current.chunks,
          (event.payload as { base64: string }).base64,
        ],
      };
    case "metric":
      return {
        ...current,
        timeMs: (event.payload as { totalMs: number }).totalMs,
      };
    case "cookie": {
      // cookie 事件承载两类信息: setCookie (本跳响应设置的) 与 sent (本跳请求实际带出的).
      const p = event.payload as {
        setCookie?: readonly string[];
        sent?: string;
      };
      return {
        ...current,
        cookies: p.setCookie
          ? [...current.cookies, ...p.setCookie]
          : current.cookies,
        // 最终跳覆盖前值, 使分页反映"这次请求带出去的 cookie".
        sentCookie: p.sent !== undefined ? p.sent : current.sentCookie,
      };
    }
    case "test":
      return {
        ...current,
        tests: [...current.tests, event.payload as TestResult],
      };
    case "log":
      return {
        ...current,
        logs: [...current.logs, (event.payload as { message: string }).message],
      };
    case "end":
      return { ...current, phase: "done" };
    case "error":
      return {
        ...current,
        phase: "error",
        error: (event.payload as { message: string }).message,
      };
    default:
      return current;
  }
}

/**
 * 把一个连接事件应用到连接状态.
 * @param current 当前连接状态.
 * @param event 流式事件.
 * @returns 更新后的连接状态.
 */
/**
 * 构造一条系统消息 (用于连接生命周期: 已连接/已关闭/错误).
 * @param data 消息文本.
 * @returns 系统方向的消息.
 */
function systemMessage(data: string): Message {
  return {
    id: newId("msg"),
    direction: "system",
    time: Date.now(),
    event: "",
    data,
  };
}

function applyEventToConnection(
  current: ConnectionState,
  event: StreamEvent,
): ConnectionState {
  switch (event.kind) {
    case "open": {
      const info = (event.payload as { info?: string }).info ?? "已连接";
      return {
        ...current,
        status: "open",
        messages: [...current.messages, systemMessage(info)],
      };
    }
    case "message": {
      const p = event.payload as {
        direction: "received" | "system";
        event: string;
        data: string;
        size?: number;
      };
      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: newId("msg"),
            direction: p.direction,
            time: Date.now(),
            event: p.event,
            data: p.data,
            size: p.size,
          },
        ],
      };
    }
    case "closed": {
      const reason = (event.payload as { reason?: string }).reason ?? "";
      return {
        ...current,
        status: "closed",
        messages: [
          ...current.messages,
          systemMessage(reason !== "" ? `已关闭: ${reason}` : "已关闭"),
        ],
      };
    }
    case "error": {
      const message = (event.payload as { message: string }).message;
      return {
        ...current,
        status: "error",
        error: message,
        messages: [...current.messages, systemMessage(`错误: ${message}`)],
      };
    }
    default:
      return current;
  }
}

/**
 * 请求调试板块的状态与动作.
 */
interface RequestStore {
  readonly tabs: readonly RequestTab[];
  readonly activeTabId: string | undefined;
  readonly sidebarSection: SidebarSection;
  readonly responses: Record<string, ResponseState>;
  readonly jobToTab: Record<string, string>;
  readonly collections: readonly Collection[];
  readonly environments: readonly Environment[];
  readonly globals: readonly KeyValueItem[];
  readonly activeEnvironmentId: string | undefined;
  readonly history: readonly HistoryEntry[];
  readonly connections: Record<string, ConnectionState>;
  readonly newTab: () => void;
  readonly closeTab: (id: string) => void;
  /** 关闭除指定标签外的其它全部标签 (被关标签的连接/请求由调用方先行断开). */
  readonly closeOtherTabs: (id: string) => void;
  /** 关闭全部标签 (连接/请求由调用方先行断开). */
  readonly closeAllTabs: () => void;
  readonly selectTab: (id: string) => void;
  readonly updateRequest: (id: string, patch: Partial<HttpRequest>) => void;
  readonly renameTab: (id: string, name: string) => void;
  readonly setSidebarSection: (section: SidebarSection) => void;
  readonly startRequest: (tabId: string, jobId: string, url?: string) => void;
  readonly applyDriverEvent: (event: StreamEvent) => void;
  readonly applyScriptVars: (
    tabId: string,
    mutations: readonly ScriptMutation[],
  ) => void;
  readonly markCancelled: (tabId: string) => void;
  readonly serialize: () => PersistedRequestState;
  readonly hydrate: (raw: unknown) => void;
  /** 新建集合并返回其 id (供调用方立即进入重命名态). */
  readonly createCollection: (name: string) => string;
  readonly deleteCollection: (id: string) => void;
  readonly renameCollection: (id: string, name: string) => void;
  readonly addFolder: (
    collectionId: string,
    parentId: string | undefined,
    name: string,
  ) => void;
  readonly renameNode: (
    collectionId: string,
    nodeId: string,
    name: string,
  ) => void;
  readonly deleteNode: (collectionId: string, nodeId: string) => void;
  /**
   * 把节点移动到目标位置 (支持跨集合); targetParentId 为 undefined 表示目标集合根.
   */
  readonly moveNode: (
    fromCollectionId: string,
    nodeId: string,
    toCollectionId: string,
    targetParentId: string | undefined,
  ) => void;
  readonly updateCollectionVariables: (
    collectionId: string,
    variables: readonly KeyValueItem[],
  ) => void;
  readonly saveTabToCollection: (
    tabId: string,
    collectionId: string,
    parentId: string | undefined,
    name: string,
  ) => void;
  /** 覆盖已有请求节点的内容与名称 (同名保存时替换而非新增副本). */
  readonly overwriteSavedRequest: (
    tabId: string,
    collectionId: string,
    nodeId: string,
    name: string,
  ) => void;
  readonly openSavedRequest: (collectionId: string, nodeId: string) => void;
  /** 新建环境并返回其 id (供调用方立即进入重命名态). */
  readonly createEnvironment: (name: string) => string;
  readonly deleteEnvironment: (id: string) => void;
  readonly renameEnvironment: (id: string, name: string) => void;
  readonly updateEnvironmentVariables: (
    id: string,
    variables: readonly KeyValueItem[],
  ) => void;
  readonly setActiveEnvironment: (id: string | undefined) => void;
  readonly updateGlobals: (variables: readonly KeyValueItem[]) => void;
  readonly pushHistory: (entry: Omit<HistoryEntry, "id" | "ts">) => void;
  readonly clearHistory: () => void;
  readonly openFromHistory: (entryId: string) => void;
  readonly importCollection: (imported: ImportedCollection) => void;
  readonly openRequestInTab: (name: string, request: HttpRequest) => void;
  readonly newProtocolTab: (protocol: Protocol) => void;
  readonly updateConnectionUrl: (tabId: string, url: string) => void;
  readonly startConnection: (tabId: string, jobId: string) => void;
  readonly applyConnectionEvent: (event: StreamEvent) => void;
  readonly appendSentMessage: (tabId: string, message: Message) => void;
  readonly clearMessages: (tabId: string) => void;
  readonly updateConnectionHeaders: (
    tabId: string,
    headers: readonly KeyValueItem[],
  ) => void;
  /** 更新当前连接标签 (按协议) 的 settings (超时/TLS/CA/客户端证书等). */
  readonly updateConnectionSettings: (
    tabId: string,
    patch: Partial<RequestSettings>,
  ) => void;
  readonly updateWsSubprotocols: (
    tabId: string,
    subprotocols: readonly string[],
  ) => void;
  readonly updateSocketIoNamespace: (tabId: string, namespace: string) => void;
  readonly updateTcpConfig: (
    tabId: string,
    patch: Partial<Pick<TcpConfig, "host" | "port" | "tls">>,
  ) => void;
  readonly updateMqttConfig: (
    tabId: string,
    patch: Partial<
      Pick<MqttConfig, "url" | "clientId" | "username" | "password">
    >,
  ) => void;
  readonly updateMqttSubscriptions: (
    tabId: string,
    subscriptions: readonly MqttSubscription[],
  ) => void;
  readonly updateGrpcConfig: (
    tabId: string,
    patch: Partial<
      Pick<
        GrpcConfig,
        "target" | "tls" | "serviceName" | "methodName" | "requestMessage"
      > & { metadata: readonly KeyValueItem[]; protoSource: ProtoSource }
    >,
  ) => void;
  readonly setGrpcServices: (
    tabId: string,
    services: readonly GrpcServiceInfo[],
  ) => void;
}

/**
 * 请求调试板块的全局 store (多标签草稿 + 侧栏分区).
 */
export const useRequestStore = create<RequestStore>((set, get) => ({
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

  newTab: () => {
    const tab: RequestTab = {
      id: newId("tab"),
      name: "未命名请求",
      request: createDefaultRequest(),
      dirty: false,
      protocol: "http",
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  closeTab: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      if (index === -1) {
        return state;
      }
      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === id) {
        const neighbor = tabs[index - 1] ?? tabs[0];
        activeTabId = neighbor?.id;
      }
      const responses = { ...state.responses };
      delete responses[id];
      const connections = { ...state.connections };
      delete connections[id];
      const jobToTab = Object.fromEntries(
        Object.entries(state.jobToTab).filter(([, tabId]) => tabId !== id),
      );
      return { tabs, activeTabId, responses, connections, jobToTab };
    });
  },

  closeOtherTabs: (id) => {
    set((state) => {
      const kept = state.tabs.find((t) => t.id === id);
      if (kept === undefined) {
        return state;
      }
      // 仅保留目标标签自身的 responses/connections/jobToTab, 其余一并清理.
      const responses =
        state.responses[id] !== undefined ? { [id]: state.responses[id] } : {};
      const connections =
        state.connections[id] !== undefined
          ? { [id]: state.connections[id] }
          : {};
      const jobToTab = Object.fromEntries(
        Object.entries(state.jobToTab).filter(([, tabId]) => tabId === id),
      );
      return {
        tabs: [kept],
        activeTabId: id,
        responses,
        connections,
        jobToTab,
      };
    });
  },

  closeAllTabs: () => {
    set({
      tabs: [],
      activeTabId: undefined,
      responses: {},
      connections: {},
      jobToTab: {},
    });
  },

  selectTab: (id) => set({ activeTabId: id }),

  updateRequest: (id, patch) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== id) {
          return tab;
        }
        let request = { ...tab.request, ...patch };
        // URL 与 Params 双向同步: 改 URL (未同时改 params) 时由查询串同步 params;
        // 改 params (未同时改 url) 时由启用参数重建 URL 查询. 同时改则按入参不再联动.
        if (patch.url !== undefined && patch.params === undefined) {
          request = {
            ...request,
            params: parseQueryToParams(patch.url, tab.request.params),
          };
        } else if (patch.params !== undefined && patch.url === undefined) {
          request = {
            ...request,
            url: applyParamsToUrl(tab.request.url, patch.params),
          };
        }
        return { ...tab, request, dirty: true };
      }),
    }));
  },

  renameTab: (id, name) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, name } : tab)),
    }));
  },

  setSidebarSection: (section) => set({ sidebarSection: section }),

  startRequest: (tabId, jobId, url = "") => {
    set((state) => ({
      jobToTab: { ...state.jobToTab, [jobId]: tabId },
      responses: {
        ...state.responses,
        [tabId]: {
          phase: "running",
          jobId,
          url,
          statusCode: 0,
          statusText: "",
          httpVersion: "",
          headers: {},
          chunks: [],
          cookies: [],
          sentCookie: "",
          timeMs: 0,
          error: "",
          tests: [],
          logs: [],
        },
      },
    }));
  },

  applyDriverEvent: (event) => {
    set((state) => {
      const tabId = state.jobToTab[event.jobId];
      if (tabId === undefined) {
        return state;
      }
      const current = state.responses[tabId];
      if (current === undefined || current.jobId !== event.jobId) {
        return state;
      }
      const next = applyEventToResponse(current, event);
      return { responses: { ...state.responses, [tabId]: next } };
    });
  },

  applyScriptVars: (tabId, mutations) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      let globals = state.globals;
      let environments = state.environments;
      let collections = state.collections;
      for (const m of mutations) {
        if (m.scope === "globals") {
          globals = applyVarMutation(globals, m);
        } else if (
          m.scope === "environment" &&
          state.activeEnvironmentId !== undefined
        ) {
          environments = environments.map((e) =>
            e.id === state.activeEnvironmentId
              ? { ...e, variables: applyVarMutation(e.variables, m) }
              : e,
          );
        } else if (
          m.scope === "collection" &&
          tab?.collectionId !== undefined
        ) {
          collections = collections.map((c) =>
            c.id === tab.collectionId
              ? { ...c, variables: applyVarMutation(c.variables, m) }
              : c,
          );
        }
        // local 忽略 (临时, 不持久化).
      }
      return { globals, environments, collections };
    });
  },

  markCancelled: (tabId) => {
    set((state) => {
      const current = state.responses[tabId];
      if (current === undefined) {
        return state;
      }
      return {
        responses: {
          ...state.responses,
          [tabId]: { ...current, phase: "cancelled", error: "已取消" },
        },
      };
    });
  },

  serialize: () => {
    const state = get();
    return {
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      sidebarSection: state.sidebarSection,
      collections: state.collections,
      environments: state.environments,
      globals: state.globals,
      activeEnvironmentId: state.activeEnvironmentId,
      history: state.history,
    };
  },

  hydrate: (raw) => {
    if (typeof raw !== "object" || raw === null) {
      return;
    }
    const data = raw as Partial<PersistedRequestState>;
    set({
      tabs: Array.isArray(data.tabs)
        ? (data.tabs as Array<RequestTab & { protocol?: Protocol }>).map(
            (t) => ({ ...t, protocol: t.protocol ?? "http" }),
          )
        : [],
      activeTabId:
        typeof data.activeTabId === "string" ? data.activeTabId : undefined,
      sidebarSection: data.sidebarSection ?? "collections",
      collections: Array.isArray(data.collections) ? data.collections : [],
      environments: Array.isArray(data.environments) ? data.environments : [],
      globals: Array.isArray(data.globals) ? data.globals : [],
      activeEnvironmentId:
        typeof data.activeEnvironmentId === "string"
          ? data.activeEnvironmentId
          : undefined,
      history: Array.isArray(data.history) ? data.history : [],
    });
  },

  createCollection: (name) => {
    const id = newId("col");
    set((state) => ({
      collections: [
        ...state.collections,
        { id, name, variables: [], nodes: [] },
      ],
    }));
    return id;
  },

  deleteCollection: (id) => {
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    }));
  },

  renameCollection: (id, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, name } : c,
      ),
    }));
  },

  addFolder: (collectionId, parentId, name) => {
    const folder: CollectionNode = {
      id: newId("fld"),
      type: "folder",
      name,
      children: [],
    };
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, nodes: insertNode(c.nodes, parentId, folder) }
          : c,
      ),
    }));
  },

  renameNode: (collectionId, nodeId, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, nodes: renameTreeNode(c.nodes, nodeId, name) }
          : c,
      ),
    }));
  },

  deleteNode: (collectionId, nodeId) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, nodes: removeNode(c.nodes, nodeId) }
          : c,
      ),
    }));
  },

  moveNode: (fromCollectionId, nodeId, toCollectionId, targetParentId) => {
    set((state) => {
      const from = state.collections.find((c) => c.id === fromCollectionId);
      const node = from ? findNode(from.nodes, nodeId) : undefined;
      if (node === undefined) {
        return state;
      }
      // 放回原地无需处理; 禁止把文件夹拖进自身或其子孙 (否则子树丢失).
      if (
        node.type === "folder" &&
        targetParentId !== undefined &&
        findNode([node], targetParentId) !== undefined
      ) {
        return state;
      }
      // 先从源集合移除, 再插入目标集合 (同集合时链式作用于同一份 nodes).
      const removed = state.collections.map((c) =>
        c.id === fromCollectionId
          ? { ...c, nodes: removeNode(c.nodes, nodeId) }
          : c,
      );
      return {
        collections: removed.map((c) =>
          c.id === toCollectionId
            ? { ...c, nodes: insertNode(c.nodes, targetParentId, node) }
            : c,
        ),
      };
    });
  },

  updateCollectionVariables: (collectionId, variables) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId ? { ...c, variables } : c,
      ),
    }));
  },

  saveTabToCollection: (tabId, collectionId, parentId, name) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab === undefined) {
        return state;
      }
      const nodeId = newId("req");
      const node: CollectionNode = {
        id: nodeId,
        type: "request",
        name,
        request: tab.request,
      };
      return {
        collections: state.collections.map((c) =>
          c.id === collectionId
            ? { ...c, nodes: insertNode(c.nodes, parentId, node) }
            : c,
        ),
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, name, collectionId, nodeId, dirty: false }
            : t,
        ),
      };
    });
  },

  overwriteSavedRequest: (tabId, collectionId, nodeId, name) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab === undefined) {
        return state;
      }
      return {
        collections: state.collections.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                // 先替换请求内容, 再对同一节点改名 (覆盖时名称不变, 保持一致).
                nodes: renameTreeNode(
                  replaceRequest(c.nodes, nodeId, tab.request),
                  nodeId,
                  name,
                ),
              }
            : c,
        ),
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, name, collectionId, nodeId, dirty: false }
            : t,
        ),
      };
    });
  },

  openSavedRequest: (collectionId, nodeId) => {
    set((state) => {
      const collection = state.collections.find((c) => c.id === collectionId);
      if (collection === undefined) {
        return state;
      }
      const node = findSavedNode(collection.nodes, nodeId);
      if (node === undefined) {
        return state;
      }
      // 该请求已在某标签打开则切换过去, 不重复新建 (以集合+节点 id 唯一标识).
      const existing = state.tabs.find(
        (t) => t.collectionId === collectionId && t.nodeId === nodeId,
      );
      if (existing !== undefined) {
        return { activeTabId: existing.id };
      }
      const tab: RequestTab = {
        id: newId("tab"),
        name: node.name,
        request: node.request,
        dirty: false,
        collectionId,
        nodeId,
        protocol: "http",
      };
      return { tabs: [...state.tabs, tab], activeTabId: tab.id };
    });
  },

  createEnvironment: (name) => {
    const id = newId("env");
    set((state) => ({
      environments: [...state.environments, { id, name, variables: [] }],
    }));
    return id;
  },

  deleteEnvironment: (id) => {
    set((state) => ({
      environments: state.environments.filter((e) => e.id !== id),
      activeEnvironmentId:
        state.activeEnvironmentId === id
          ? undefined
          : state.activeEnvironmentId,
    }));
  },

  renameEnvironment: (id, name) => {
    set((state) => ({
      environments: state.environments.map((e) =>
        e.id === id ? { ...e, name } : e,
      ),
    }));
  },

  updateEnvironmentVariables: (id, variables) => {
    set((state) => ({
      environments: state.environments.map((e) =>
        e.id === id ? { ...e, variables } : e,
      ),
    }));
  },

  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  updateGlobals: (variables) => set({ globals: variables }),

  pushHistory: (entry) => {
    set((state) => ({
      history: [
        { ...entry, id: newId("his"), ts: Date.now() },
        ...state.history,
      ].slice(0, HISTORY_LIMIT),
    }));
  },

  clearHistory: () => set({ history: [] }),

  openFromHistory: (entryId) => {
    set((state) => {
      const entry = state.history.find((h) => h.id === entryId);
      if (entry === undefined) {
        return state;
      }
      const tab: RequestTab = {
        id: newId("tab"),
        name: entry.url === "" ? "未命名请求" : entry.url,
        request: entry.request,
        dirty: false,
        protocol: "http",
      };
      return { tabs: [...state.tabs, tab], activeTabId: tab.id };
    });
  },

  importCollection: (imported) => {
    set((state) => ({
      collections: [
        ...state.collections,
        {
          id: newId("col"),
          name: imported.name,
          variables: imported.variables,
          nodes: imported.nodes,
        },
      ],
    }));
  },

  openRequestInTab: (name, request) => {
    set((state) => {
      const tab: RequestTab = {
        id: newId("tab"),
        name,
        request,
        dirty: false,
        protocol: "http",
      };
      return { tabs: [...state.tabs, tab], activeTabId: tab.id };
    });
  },

  newProtocolTab: (protocol) => {
    const tab: RequestTab = {
      id: newId("tab"),
      name:
        protocol === "websocket"
          ? "WS 连接"
          : protocol === "socketio"
            ? "Socket.IO"
            : protocol === "sse"
              ? "SSE 连接"
              : protocol === "mqtt"
                ? "MQTT 连接"
                : protocol === "grpc"
                  ? "gRPC 调用"
                  : "TCP 连接",
      request: createDefaultRequest(),
      dirty: false,
      protocol,
      ws: protocol === "websocket" ? createDefaultWsConfig() : undefined,
      socketio:
        protocol === "socketio" ? createDefaultSocketIoConfig() : undefined,
      sse: protocol === "sse" ? createDefaultSseConfig() : undefined,
      tcp: protocol === "tcp" ? createDefaultTcpConfig() : undefined,
      mqtt: protocol === "mqtt" ? createDefaultMqttConfig() : undefined,
      grpc: protocol === "grpc" ? createDefaultGrpcConfig() : undefined,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  updateConnectionUrl: (tabId, url) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }
        if (tab.protocol === "websocket" && tab.ws !== undefined) {
          return { ...tab, ws: { ...tab.ws, url }, dirty: true };
        }
        if (tab.protocol === "socketio" && tab.socketio !== undefined) {
          return { ...tab, socketio: { ...tab.socketio, url }, dirty: true };
        }
        if (tab.protocol === "sse" && tab.sse !== undefined) {
          return { ...tab, sse: { ...tab.sse, url }, dirty: true };
        }
        return tab;
      }),
    }));
  },

  startConnection: (tabId, jobId) => {
    set((state) => ({
      jobToTab: { ...state.jobToTab, [jobId]: tabId },
      connections: {
        ...state.connections,
        [tabId]: { status: "connecting", jobId, messages: [], error: "" },
      },
    }));
  },

  applyConnectionEvent: (event) => {
    set((state) => {
      const tabId = state.jobToTab[event.jobId];
      if (tabId === undefined) {
        return state;
      }
      const current = state.connections[tabId];
      if (current === undefined || current.jobId !== event.jobId) {
        return state;
      }
      return {
        connections: {
          ...state.connections,
          [tabId]: applyEventToConnection(current, event),
        },
      };
    });
  },

  appendSentMessage: (tabId, message) => {
    set((state) => {
      const current = state.connections[tabId];
      if (current === undefined) {
        return state;
      }
      return {
        connections: {
          ...state.connections,
          [tabId]: { ...current, messages: [...current.messages, message] },
        },
      };
    });
  },

  clearMessages: (tabId) => {
    set((state) => {
      const current = state.connections[tabId];
      if (current === undefined) {
        return state;
      }
      return {
        connections: {
          ...state.connections,
          [tabId]: { ...current, messages: [] },
        },
      };
    });
  },

  updateConnectionHeaders: (tabId, headers) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }
        if (tab.protocol === "websocket" && tab.ws) {
          return { ...tab, ws: { ...tab.ws, headers }, dirty: true };
        }
        if (tab.protocol === "socketio" && tab.socketio) {
          return {
            ...tab,
            socketio: { ...tab.socketio, headers },
            dirty: true,
          };
        }
        if (tab.protocol === "sse" && tab.sse) {
          return { ...tab, sse: { ...tab.sse, headers }, dirty: true };
        }
        return tab;
      }),
    }));
  },

  updateConnectionSettings: (tabId, patch) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }
        if (tab.protocol === "websocket" && tab.ws) {
          return {
            ...tab,
            ws: { ...tab.ws, settings: { ...tab.ws.settings, ...patch } },
            dirty: true,
          };
        }
        if (tab.protocol === "socketio" && tab.socketio) {
          return {
            ...tab,
            socketio: {
              ...tab.socketio,
              settings: { ...tab.socketio.settings, ...patch },
            },
            dirty: true,
          };
        }
        if (tab.protocol === "sse" && tab.sse) {
          return {
            ...tab,
            sse: { ...tab.sse, settings: { ...tab.sse.settings, ...patch } },
            dirty: true,
          };
        }
        if (tab.protocol === "tcp" && tab.tcp) {
          return {
            ...tab,
            tcp: { ...tab.tcp, settings: { ...tab.tcp.settings, ...patch } },
            dirty: true,
          };
        }
        if (tab.protocol === "mqtt" && tab.mqtt) {
          return {
            ...tab,
            mqtt: { ...tab.mqtt, settings: { ...tab.mqtt.settings, ...patch } },
            dirty: true,
          };
        }
        if (tab.protocol === "grpc" && tab.grpc) {
          return {
            ...tab,
            grpc: { ...tab.grpc, settings: { ...tab.grpc.settings, ...patch } },
            dirty: true,
          };
        }
        return tab;
      }),
    }));
  },

  updateWsSubprotocols: (tabId, subprotocols) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "websocket" && tab.ws
          ? { ...tab, ws: { ...tab.ws, subprotocols }, dirty: true }
          : tab,
      ),
    }));
  },

  updateSocketIoNamespace: (tabId, namespace) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "socketio" && tab.socketio
          ? { ...tab, socketio: { ...tab.socketio, namespace }, dirty: true }
          : tab,
      ),
    }));
  },

  updateTcpConfig: (tabId, patch) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "tcp" && tab.tcp
          ? { ...tab, tcp: { ...tab.tcp, ...patch }, dirty: true }
          : tab,
      ),
    }));
  },

  updateMqttConfig: (tabId, patch) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "mqtt" && tab.mqtt
          ? { ...tab, mqtt: { ...tab.mqtt, ...patch }, dirty: true }
          : tab,
      ),
    }));
  },

  updateMqttSubscriptions: (tabId, subscriptions) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "mqtt" && tab.mqtt
          ? { ...tab, mqtt: { ...tab.mqtt, subscriptions }, dirty: true }
          : tab,
      ),
    }));
  },

  updateGrpcConfig: (tabId, patch) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "grpc" && tab.grpc
          ? { ...tab, grpc: { ...tab.grpc, ...patch }, dirty: true }
          : tab,
      ),
    }));
  },

  setGrpcServices: (tabId, services) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId && tab.protocol === "grpc"
          ? { ...tab, grpcServices: services }
          : tab,
      ),
    }));
  },
}));
