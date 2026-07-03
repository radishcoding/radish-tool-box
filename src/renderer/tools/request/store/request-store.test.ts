import { beforeEach, describe, expect, it } from "vitest";

import { useRequestStore } from "./request-store";

function reset(): void {
  useRequestStore.setState({
    tabs: [],
    activeTabId: undefined,
    sidebarSection: "collections",
  });
}

describe("useRequestStore", () => {
  beforeEach(reset);

  it("newTab 新增标签并激活", () => {
    useRequestStore.getState().newTab();
    const s = useRequestStore.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.activeTabId).toBe(s.tabs[0].id);
    expect(s.tabs[0].request.method).toBe("GET");
    expect(s.tabs[0].dirty).toBe(false);
  });

  it("updateRequest 局部更新并置 dirty", () => {
    const store = useRequestStore.getState();
    store.newTab();
    const id = useRequestStore.getState().tabs[0].id;
    store.updateRequest(id, { url: "https://x.com", method: "POST" });
    const tab = useRequestStore.getState().tabs[0];
    expect(tab.request.url).toBe("https://x.com");
    expect(tab.request.method).toBe("POST");
    expect(tab.dirty).toBe(true);
  });

  it("selectTab 切换活动标签", () => {
    const store = useRequestStore.getState();
    store.newTab();
    store.newTab();
    const firstId = useRequestStore.getState().tabs[0].id;
    store.selectTab(firstId);
    expect(useRequestStore.getState().activeTabId).toBe(firstId);
  });

  it("closeTab 关闭活动标签后激活相邻标签", () => {
    const store = useRequestStore.getState();
    store.newTab();
    store.newTab();
    const [a, b] = useRequestStore.getState().tabs;
    store.selectTab(b.id);
    store.closeTab(b.id);
    const s = useRequestStore.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.activeTabId).toBe(a.id);
  });

  it("closeTab 关闭最后一个标签后 activeTabId 为 undefined", () => {
    const store = useRequestStore.getState();
    store.newTab();
    const id = useRequestStore.getState().tabs[0].id;
    store.closeTab(id);
    expect(useRequestStore.getState().activeTabId).toBeUndefined();
  });

  it("closeTab 关闭 running 标签后清理 responses 与 jobToTab", () => {
    useRequestStore.setState({ responses: {}, jobToTab: {} });
    const store = useRequestStore.getState();
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.startRequest(tabId, "job-abc");
    expect(useRequestStore.getState().responses[tabId]?.phase).toBe("running");
    expect(useRequestStore.getState().jobToTab["job-abc"]).toBe(tabId);
    store.closeTab(tabId);
    const s = useRequestStore.getState();
    expect(Object.prototype.hasOwnProperty.call(s.responses, tabId)).toBe(
      false,
    );
    expect(Object.values(s.jobToTab)).not.toContain(tabId);
  });

  it("closeOtherTabs 仅保留目标标签并激活它", () => {
    useRequestStore.setState({ responses: {}, connections: {}, jobToTab: {} });
    const store = useRequestStore.getState();
    store.newTab();
    store.newTab();
    store.newTab();
    const [, b] = useRequestStore.getState().tabs;
    store.closeOtherTabs(b.id);
    const s = useRequestStore.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0].id).toBe(b.id);
    expect(s.activeTabId).toBe(b.id);
  });

  it("closeOtherTabs 清理被关标签的 connections 与 jobToTab, 保留目标的", () => {
    useRequestStore.setState({ responses: {}, connections: {}, jobToTab: {} });
    const store = useRequestStore.getState();
    store.newTab();
    store.newTab();
    const [a, b] = useRequestStore.getState().tabs;
    store.startConnection(a.id, "job-a");
    store.startConnection(b.id, "job-b");
    store.closeOtherTabs(b.id);
    const s = useRequestStore.getState();
    expect(Object.prototype.hasOwnProperty.call(s.connections, a.id)).toBe(
      false,
    );
    expect(s.connections[b.id]).toBeDefined();
    expect(s.jobToTab["job-a"]).toBeUndefined();
    expect(s.jobToTab["job-b"]).toBe(b.id);
  });

  it("closeAllTabs 清空全部标签与关联状态", () => {
    useRequestStore.setState({ responses: {}, connections: {}, jobToTab: {} });
    const store = useRequestStore.getState();
    store.newTab();
    store.newTab();
    const [a] = useRequestStore.getState().tabs;
    store.startConnection(a.id, "job-a");
    store.closeAllTabs();
    const s = useRequestStore.getState();
    expect(s.tabs).toHaveLength(0);
    expect(s.activeTabId).toBeUndefined();
    expect(s.connections).toEqual({});
    expect(s.jobToTab).toEqual({});
  });

  it("renameTab 改名", () => {
    const store = useRequestStore.getState();
    store.newTab();
    const id = useRequestStore.getState().tabs[0].id;
    store.renameTab(id, "登录接口");
    expect(useRequestStore.getState().tabs[0].name).toBe("登录接口");
  });

  it("serialize/hydrate 往返", () => {
    const store = useRequestStore.getState();
    store.newTab();
    store.setSidebarSection("history");
    const snap = useRequestStore.getState().serialize();
    reset();
    useRequestStore.getState().hydrate(snap);
    const s = useRequestStore.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.sidebarSection).toBe("history");
  });

  it("hydrate 忽略非法输入", () => {
    useRequestStore.getState().hydrate("nonsense");
    expect(useRequestStore.getState().tabs).toEqual([]);
    useRequestStore.getState().hydrate(undefined);
    expect(useRequestStore.getState().tabs).toEqual([]);
  });

  // ── 高: closeTab 清理 connections ──────────────────────────────────────────
  it("closeTab 后 connections 不含该 tab, jobId 从 jobToTab 移除", () => {
    useRequestStore.setState({ connections: {}, jobToTab: {}, responses: {} });
    const store = useRequestStore.getState();
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.startConnection(tabId, "conn-job");
    expect(useRequestStore.getState().connections[tabId]).toBeDefined();
    expect(useRequestStore.getState().jobToTab["conn-job"]).toBe(tabId);
    store.closeTab(tabId);
    const s = useRequestStore.getState();
    expect(Object.prototype.hasOwnProperty.call(s.connections, tabId)).toBe(
      false,
    );
    expect(Object.values(s.jobToTab)).not.toContain(tabId);
  });

  // ── 中: hydrate 旧数据兜底 protocol ────────────────────────────────────────
  it("hydrate 旧数据 (无 protocol 字段) 后 tabs[0].protocol 默认为 'http'", () => {
    const legacyData = {
      tabs: [{ id: "t-old", name: "旧请求", request: {}, dirty: false }],
    };
    useRequestStore.getState().hydrate(legacyData);
    expect(useRequestStore.getState().tabs[0].protocol).toBe("http");
  });
});
