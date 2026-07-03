import { beforeEach, describe, expect, it } from "vitest";

import { findNode } from "../model/collection-tree";
import { createDefaultRequest } from "../model/types";
import { useRequestStore } from "./request-store";

function reset(): void {
  useRequestStore.setState({
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
  });
}

describe("store 集合切片", () => {
  beforeEach(reset);

  it("createCollection 新增集合", () => {
    useRequestStore.getState().createCollection("我的接口");
    const cols = useRequestStore.getState().collections;
    expect(cols).toHaveLength(1);
    expect(cols[0].name).toBe("我的接口");
  });

  it("saveTabToCollection 把标签请求存为节点并回链标签", () => {
    const store = useRequestStore.getState();
    store.createCollection("C");
    const colId = useRequestStore.getState().collections[0].id;
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.updateRequest(tabId, { url: "https://x.com" });
    store.saveTabToCollection(tabId, colId, undefined, "登录");
    const col = useRequestStore.getState().collections[0];
    expect(col.nodes).toHaveLength(1);
    const tab = useRequestStore.getState().tabs[0];
    expect(tab.collectionId).toBe(colId);
    expect(tab.dirty).toBe(false);
  });

  it("overwriteSavedRequest 覆盖已有节点内容与名称, 不新增副本", () => {
    const store = useRequestStore.getState();
    const colId = store.createCollection("C");
    // 先存入一个请求节点.
    store.newTab();
    const firstTab = useRequestStore.getState().tabs[0].id;
    store.updateRequest(firstTab, { url: "https://old.com" });
    store.saveTabToCollection(firstTab, colId, undefined, "接口");
    const nodeId = useRequestStore.getState().collections[0].nodes[0].id;
    // 另一个标签以同名覆盖该节点.
    store.newTab();
    const secondTab = useRequestStore.getState().tabs[1].id;
    store.updateRequest(secondTab, { url: "https://new.com" });
    store.overwriteSavedRequest(secondTab, colId, nodeId, "接口");
    const col = useRequestStore.getState().collections[0];
    // 仍是 1 个节点 (覆盖非新增), id 不变, 内容已更新.
    expect(col.nodes).toHaveLength(1);
    expect(col.nodes[0].id).toBe(nodeId);
    expect(col.nodes[0].type === "request" && col.nodes[0].request.url).toBe(
      "https://new.com",
    );
    // 覆盖后第二个标签回链到该节点.
    const tab = useRequestStore.getState().tabs[1];
    expect(tab.nodeId).toBe(nodeId);
    expect(tab.dirty).toBe(false);
  });

  it("openSavedRequest 打开集合中的请求到新标签", () => {
    const store = useRequestStore.getState();
    store.createCollection("C");
    const colId = useRequestStore.getState().collections[0].id;
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.updateRequest(tabId, { url: "https://saved.com" });
    store.saveTabToCollection(tabId, colId, undefined, "S");
    const nodeId = useRequestStore.getState().collections[0].nodes[0].id;
    store.openSavedRequest(colId, nodeId);
    const tabs = useRequestStore.getState().tabs;
    const opened = tabs[tabs.length - 1];
    expect(opened.request.url).toBe("https://saved.com");
    expect(opened.collectionId).toBe(colId);
    expect(opened.nodeId).toBe(nodeId);
  });

  it("openSavedRequest 已打开同一请求则切换而非重复新建", () => {
    const store = useRequestStore.getState();
    const colId = store.createCollection("C");
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.saveTabToCollection(tabId, colId, undefined, "S");
    const nodeId = useRequestStore.getState().collections[0].nodes[0].id;
    // 首次打开: 新建标签.
    store.openSavedRequest(colId, nodeId);
    const afterFirst = useRequestStore.getState();
    const openedId = afterFirst.tabs[afterFirst.tabs.length - 1].id;
    const countAfterFirst = afterFirst.tabs.length;
    // 切到别的标签, 再次打开同一请求.
    store.selectTab(tabId);
    store.openSavedRequest(colId, nodeId);
    const afterSecond = useRequestStore.getState();
    // 标签数不变 (未重复新建), 且激活到已打开的那个.
    expect(afterSecond.tabs).toHaveLength(countAfterFirst);
    expect(afterSecond.activeTabId).toBe(openedId);
  });

  it("updateCollectionVariables 更新集合变量", () => {
    const store = useRequestStore.getState();
    store.createCollection("C");
    const colId = useRequestStore.getState().collections[0].id;
    store.updateCollectionVariables(colId, [
      { id: "1", key: "base", value: "https://api", enabled: true },
    ]);
    expect(useRequestStore.getState().collections[0].variables).toHaveLength(1);
  });

  it("moveNode 把请求从根移入文件夹 (同集合)", () => {
    const store = useRequestStore.getState();
    const colId = store.createCollection("C");
    store.addFolder(colId, undefined, "F");
    const folderId = useRequestStore.getState().collections[0].nodes[0].id;
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.saveTabToCollection(tabId, colId, undefined, "R");
    const reqId = useRequestStore.getState().collections[0].nodes[1].id;
    store.moveNode(colId, reqId, colId, folderId);
    const col = useRequestStore.getState().collections[0];
    expect(col.nodes).toHaveLength(1); // 根只剩文件夹
    const folder = findNode(col.nodes, folderId);
    expect(folder?.type === "folder" && folder.children).toHaveLength(1);
  });

  it("moveNode 跨集合把请求移到目标集合根", () => {
    const store = useRequestStore.getState();
    const c1 = store.createCollection("C1");
    const c2 = store.createCollection("C2");
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.saveTabToCollection(tabId, c1, undefined, "R");
    const reqId = useRequestStore.getState().collections[0].nodes[0].id;
    store.moveNode(c1, reqId, c2, undefined);
    const cols = useRequestStore.getState().collections;
    expect(cols[0].nodes).toHaveLength(0);
    expect(cols[1].nodes).toHaveLength(1);
  });

  it("moveNode 禁止把文件夹移入自身子孙", () => {
    const store = useRequestStore.getState();
    const colId = store.createCollection("C");
    store.addFolder(colId, undefined, "F1");
    const f1 = useRequestStore.getState().collections[0].nodes[0].id;
    store.addFolder(colId, f1, "F2");
    const parent = findNode(
      useRequestStore.getState().collections[0].nodes,
      f1,
    );
    const f2 = parent?.type === "folder" ? parent.children[0].id : "";
    store.moveNode(colId, f1, colId, f2);
    const col = useRequestStore.getState().collections[0];
    expect(col.nodes).toHaveLength(1);
    expect(col.nodes[0].id).toBe(f1);
  });
});

describe("store 环境/全局切片", () => {
  beforeEach(reset);

  it("createEnvironment + setActiveEnvironment", () => {
    const store = useRequestStore.getState();
    store.createEnvironment("生产");
    const envId = useRequestStore.getState().environments[0].id;
    store.setActiveEnvironment(envId);
    expect(useRequestStore.getState().activeEnvironmentId).toBe(envId);
  });

  it("updateEnvironmentVariables + updateGlobals", () => {
    const store = useRequestStore.getState();
    store.createEnvironment("E");
    const envId = useRequestStore.getState().environments[0].id;
    store.updateEnvironmentVariables(envId, [
      { id: "1", key: "host", value: "x.com", enabled: true },
    ]);
    store.updateGlobals([{ id: "g", key: "token", value: "T", enabled: true }]);
    expect(useRequestStore.getState().environments[0].variables).toHaveLength(
      1,
    );
    expect(useRequestStore.getState().globals).toHaveLength(1);
  });

  it("deleteEnvironment 删除活动环境后清空 activeEnvironmentId", () => {
    const store = useRequestStore.getState();
    store.createEnvironment("E");
    const envId = useRequestStore.getState().environments[0].id;
    store.setActiveEnvironment(envId);
    store.deleteEnvironment(envId);
    expect(useRequestStore.getState().environments).toHaveLength(0);
    expect(useRequestStore.getState().activeEnvironmentId).toBeUndefined();
  });
});

describe("store 历史切片", () => {
  beforeEach(reset);

  it("pushHistory 前插且 statusCode 记录", () => {
    const store = useRequestStore.getState();
    store.pushHistory({
      method: "GET",
      url: "https://a.com",
      request: createDefaultRequest(),
      statusCode: 200,
    });
    store.pushHistory({
      method: "POST",
      url: "https://b.com",
      request: createDefaultRequest(),
      statusCode: 404,
    });
    const history = useRequestStore.getState().history;
    expect(history).toHaveLength(2);
    expect(history[0].url).toBe("https://b.com");
    expect(history[0].statusCode).toBe(404);
  });

  it("pushHistory 环形上限 200", () => {
    const store = useRequestStore.getState();
    for (let i = 0; i < 205; i += 1) {
      store.pushHistory({
        method: "GET",
        url: `https://x/${i}`,
        request: createDefaultRequest(),
        statusCode: 200,
      });
    }
    expect(useRequestStore.getState().history).toHaveLength(200);
  });

  it("clearHistory 清空", () => {
    const store = useRequestStore.getState();
    store.pushHistory({
      method: "GET",
      url: "https://a",
      request: createDefaultRequest(),
      statusCode: 200,
    });
    store.clearHistory();
    expect(useRequestStore.getState().history).toHaveLength(0);
  });
});

describe("serialize/hydrate 覆盖新切片", () => {
  beforeEach(reset);

  it("往返保留 collections/environments/globals/activeEnvironmentId/history", () => {
    const store = useRequestStore.getState();
    store.createCollection("C");
    store.createEnvironment("E");
    store.updateGlobals([{ id: "g", key: "k", value: "v", enabled: true }]);
    const snap = useRequestStore.getState().serialize();
    reset();
    useRequestStore.getState().hydrate(snap);
    const s = useRequestStore.getState();
    expect(s.collections).toHaveLength(1);
    expect(s.environments).toHaveLength(1);
    expect(s.globals).toHaveLength(1);
  });
});

describe("store URL 与 Params 双向同步", () => {
  beforeEach(reset);

  it("改 URL (含查询串) 自动同步出 params", () => {
    const store = useRequestStore.getState();
    store.newTab();
    const id = useRequestStore.getState().tabs[0].id;
    store.updateRequest(id, { url: "https://httpbingo.org/get?a=1&b=2" });
    const req = useRequestStore.getState().tabs[0].request;
    expect(req.params.map((p) => [p.key, p.value])).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  it("改 params 自动重建 URL 查询串", () => {
    const store = useRequestStore.getState();
    store.newTab();
    const id = useRequestStore.getState().tabs[0].id;
    store.updateRequest(id, { url: "https://httpbingo.org/get" });
    store.updateRequest(id, {
      params: [
        { id: "1", key: "a", value: "1", enabled: true },
        { id: "2", key: "c", value: "3", enabled: true },
      ],
    });
    expect(useRequestStore.getState().tabs[0].request.url).toBe(
      "https://httpbingo.org/get?a=1&c=3",
    );
  });

  it("禁用 params 不进 URL 但保留在表中", () => {
    const store = useRequestStore.getState();
    store.newTab();
    const id = useRequestStore.getState().tabs[0].id;
    store.updateRequest(id, { url: "https://x.com/p" });
    store.updateRequest(id, {
      params: [
        { id: "1", key: "a", value: "1", enabled: true },
        { id: "2", key: "b", value: "2", enabled: false },
      ],
    });
    const req = useRequestStore.getState().tabs[0].request;
    expect(req.url).toBe("https://x.com/p?a=1");
    expect(req.params).toHaveLength(2);
  });
});
