import { useEffect } from "react";

import type {
  ConnectionConfig,
  HttpRequest,
  OutboundMessage,
  ScriptMutation,
} from "@/tools/request/model/types";
import { buildExecuteJob } from "@/tools/request/model/build-job";
import { buildScopesFromStore } from "@/tools/request/model/variable-scopes";
import { useRequestStore } from "@/tools/request/store/request-store";

/**
 * 由当前 store 状态为某标签装配四级变量作用域.
 * @param tabId 标签 id.
 * @returns 四级作用域.
 */
function scopesForTab(tabId: string): ReturnType<typeof buildScopesFromStore> {
  const state = useRequestStore.getState();
  const tab = state.tabs.find((t) => t.id === tabId);
  const activeEnv = state.environments.find(
    (e) => e.id === state.activeEnvironmentId,
  );
  const collection = state.collections.find((c) => c.id === tab?.collectionId);
  return buildScopesFromStore(
    state.globals,
    activeEnv,
    collection?.variables ?? [],
  );
}

/**
 * 发送一个标签的请求: 装配作用域, 生成 jobId, 登记 running 响应, 下发执行作业.
 * @param tabId 标签 id.
 * @param request 该标签的高层请求.
 */
export function sendRequest(tabId: string, request: HttpRequest): void {
  const jobId = `job-${crypto.randomUUID()}`;
  const scopes = scopesForTab(tabId);
  useRequestStore.getState().startRequest(tabId, jobId, request.url);
  void window.networkApi.execute(buildExecuteJob(request, jobId, scopes));
}

/**
 * 取消一个标签正在进行的请求.
 * @param tabId 标签 id.
 * @param jobId 进行中的作业 id.
 */
export function cancelRequest(tabId: string, jobId: string): void {
  window.networkApi.cancel(jobId);
  useRequestStore.getState().markCancelled(tabId);
}

/**
 * 为某协议标签装配连接配置并建立连接.
 * @param tabId 标签 id.
 * @param config 连接配置.
 */
export function connect(tabId: string, config: ConnectionConfig): void {
  const jobId = `conn-${crypto.randomUUID()}`;
  const scopes = scopesForTab(tabId);
  useRequestStore.getState().startConnection(tabId, jobId);
  window.networkApi.connect({ jobId, config, variableScopes: scopes });
}

/**
 * 向某标签的连接发送消息 (并记入消息流).
 * @param tabId 标签 id.
 * @param message 出站消息.
 */
export function sendMessage(tabId: string, message: OutboundMessage): void {
  const conn = useRequestStore.getState().connections[tabId];
  if (conn === undefined) {
    return;
  }
  window.networkApi.sendMessage(conn.jobId, message);
  useRequestStore.getState().appendSentMessage(tabId, {
    id: `msg-${crypto.randomUUID()}`,
    direction: "sent",
    time: Date.now(),
    event: message.event,
    data: message.data,
  });
}

/**
 * 断开某标签的连接.
 * @param tabId 标签 id.
 */
export function disconnect(tabId: string): void {
  const conn = useRequestStore.getState().connections[tabId];
  if (conn !== undefined) {
    window.networkApi.disconnect(conn.jobId);
  }
}

/**
 * 挂载一次: 订阅主进程流式事件, 按 jobId 路由进 store; 请求结束 (end/error) 时记录历史.
 */
export function useRequestExecution(): void {
  useEffect(() => {
    const unsubscribe = window.networkApi.onEvent((event) => {
      useRequestStore.getState().applyDriverEvent(event);
      if (
        event.kind === "open" ||
        event.kind === "message" ||
        event.kind === "closed" ||
        event.kind === "error"
      ) {
        useRequestStore.getState().applyConnectionEvent(event);
      }
      if (event.kind === "vars") {
        const store = useRequestStore.getState();
        const tabId = store.jobToTab[event.jobId];
        if (tabId !== undefined) {
          store.applyScriptVars(
            tabId,
            (event.payload as { mutations: readonly ScriptMutation[] })
              .mutations,
          );
        }
      }
      if (event.kind === "end" || event.kind === "error") {
        // 在 applyDriverEvent 之后重取快照, 确保读到已更新的响应状态.
        const store = useRequestStore.getState();
        const tabId = store.jobToTab[event.jobId];
        const response = tabId ? store.responses[tabId] : undefined;
        const tab = tabId ? store.tabs.find((t) => t.id === tabId) : undefined;
        // 仅 HTTP 标签记录历史; 连接标签 (WS/SocketIO/SSE) 的 error 不应写入空白请求历史.
        if (tab !== undefined && tab.protocol === "http") {
          store.pushHistory({
            method: tab.request.method,
            url: tab.request.url,
            request: tab.request,
            statusCode: response?.statusCode ?? 0,
          });
        }
      }
    });
    return unsubscribe;
  }, []);
}
