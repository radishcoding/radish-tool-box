import { beforeEach, describe, expect, it } from "vitest";

import type { ScriptMutation, StreamEvent } from "../model/types";
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

const ev = (kind: StreamEvent["kind"], payload: unknown): StreamEvent => ({
  jobId: "j1",
  kind,
  payload,
});

describe("store 脚本结果", () => {
  beforeEach(reset);

  it("applyDriverEvent 累积 test 与 log", () => {
    const store = useRequestStore.getState();
    store.startRequest("t1", "j1");
    store.applyDriverEvent(ev("test", { name: "A", passed: true, error: "" }));
    store.applyDriverEvent(ev("log", { message: "hi" }));
    const r = useRequestStore.getState().responses["t1"];
    expect(r.tests).toHaveLength(1);
    expect(r.tests[0].name).toBe("A");
    expect(r.logs).toEqual(["hi"]);
  });

  it("applyScriptVars 把 environment 改动写入活动环境", () => {
    const store = useRequestStore.getState();
    store.createEnvironment("E");
    const envId = useRequestStore.getState().environments[0].id;
    store.setActiveEnvironment(envId);
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    const mutations: ScriptMutation[] = [
      { scope: "environment", action: "set", key: "token", value: "T" },
      { scope: "globals", action: "set", key: "g", value: "G" },
    ];
    store.applyScriptVars(tabId, mutations);
    const env = useRequestStore.getState().environments[0];
    expect(env.variables.find((v) => v.key === "token")?.value).toBe("T");
    expect(
      useRequestStore.getState().globals.find((v) => v.key === "g")?.value,
    ).toBe("G");
  });

  it("applyScriptVars unset 删除变量, local 忽略", () => {
    const store = useRequestStore.getState();
    store.updateGlobals([{ id: "1", key: "x", value: "1", enabled: true }]);
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.applyScriptVars(tabId, [
      { scope: "globals", action: "unset", key: "x", value: "" },
      { scope: "local", action: "set", key: "l", value: "v" },
    ]);
    expect(
      useRequestStore.getState().globals.find((v) => v.key === "x"),
    ).toBeUndefined();
  });

  // ── 中: collection scope 写回 ──────────────────────────────────────────────
  it("applyScriptVars collection scope 写入 tab 对应集合 variables", () => {
    const store = useRequestStore.getState();
    store.createCollection("C");
    const colId = useRequestStore.getState().collections[0].id;
    // 手动注入一个与集合关联的 tab.
    useRequestStore.setState((s) => ({
      tabs: [
        ...s.tabs,
        {
          id: "t-col",
          name: "n",
          request: {
            method: "GET" as const,
            url: "",
            params: [],
            headers: [],
            cleanMode: false,
            auth: { type: "none" as const },
            body: { type: "none" as const },
            settings: {
              followRedirects: true,
              maxRedirects: 5,
              timeoutMs: 30000,
              sslVerify: true,
            },
            preScript: "",
            postScript: "",
          },
          dirty: false,
          protocol: "http" as const,
          collectionId: colId,
        },
      ],
    }));
    store.applyScriptVars("t-col", [
      { scope: "collection", action: "set", key: "cv", value: "CV" },
    ]);
    const col = useRequestStore
      .getState()
      .collections.find((c) => c.id === colId);
    expect(col?.variables.find((v) => v.key === "cv")?.value).toBe("CV");
  });

  it("applyScriptVars environment scope: activeEnvironmentId 为 undefined 时跳过", () => {
    const store = useRequestStore.getState();
    store.createEnvironment("E2");
    // 不设置 activeEnvironmentId.
    useRequestStore.setState({ activeEnvironmentId: undefined });
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.applyScriptVars(tabId, [
      { scope: "environment", action: "set", key: "k", value: "v" },
    ]);
    // 无活动环境, 变量不应被写入任何环境.
    const envs = useRequestStore.getState().environments;
    for (const env of envs) {
      expect(env.variables.find((v) => v.key === "k")).toBeUndefined();
    }
  });

  it("applyScriptVars collection scope: tab 无 collectionId 时跳过", () => {
    const store = useRequestStore.getState();
    store.createCollection("C2");
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    // tab 没有 collectionId.
    store.applyScriptVars(tabId, [
      { scope: "collection", action: "set", key: "k", value: "v" },
    ]);
    // 集合 variables 不变.
    const col = useRequestStore.getState().collections[0];
    expect(col.variables.find((v) => v.key === "k")).toBeUndefined();
  });
});
