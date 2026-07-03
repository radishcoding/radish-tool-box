import { beforeEach, describe, expect, it } from "vitest";

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

describe("store 导入动作", () => {
  beforeEach(reset);

  it("importCollection 落库为新集合", () => {
    useRequestStore.getState().importCollection({
      name: "导入的集合",
      variables: [],
      nodes: [
        {
          id: "n1",
          type: "request",
          name: "登录",
          request: createDefaultRequest(),
        },
      ],
    });
    const cols = useRequestStore.getState().collections;
    expect(cols).toHaveLength(1);
    expect(cols[0].name).toBe("导入的集合");
    expect(cols[0].nodes).toHaveLength(1);
  });

  it("openRequestInTab 开新标签", () => {
    const req = { ...createDefaultRequest(), url: "https://imported.com" };
    useRequestStore.getState().openRequestInTab("curl 请求", req);
    const tabs = useRequestStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe("curl 请求");
    expect(tabs[0].request.url).toBe("https://imported.com");
    expect(useRequestStore.getState().activeTabId).toBe(tabs[0].id);
  });
});
