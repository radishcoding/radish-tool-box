// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useRequestStore } from "../store/request-store";
import { RequestAddressBar } from "./request-address-bar";

afterEach(cleanup);

function reset(): void {
  useRequestStore.setState({
    tabs: [],
    activeTabId: undefined,
    collections: [],
    environments: [],
    globals: [],
    activeEnvironmentId: undefined,
    responses: {},
    jobToTab: {},
  });
}

describe("地址栏变量解析预览", () => {
  it("禁用全局变量后, 解析预览由值变为字面量", () => {
    reset();
    const store = useRequestStore.getState();
    store.updateGlobals([
      { id: "1", key: "host", value: "api.com", enabled: true },
    ]);
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.updateRequest(tabId, { url: "https://{{host}}/get" });
    const currentTab = () =>
      useRequestStore.getState().tabs.find((t) => t.id === tabId)!;

    const { rerender } = render(<RequestAddressBar tab={currentTab()} />);
    expect(screen.getByText(/解析:/).textContent).toContain(
      "https://api.com/get",
    );

    // 取消勾选该全局变量.
    act(() => {
      useRequestStore
        .getState()
        .updateGlobals([
          { id: "1", key: "host", value: "api.com", enabled: false },
        ]);
    });
    rerender(<RequestAddressBar tab={currentTab()} />);

    expect(screen.getByText(/解析:/).textContent).toContain(
      "https://{{host}}/get",
    );
  });

  it("同名变量: 活动环境优先于全局 (解析预览)", () => {
    reset();
    const store = useRequestStore.getState();
    store.updateGlobals([
      { id: "g", key: "host", value: "GLOBAL", enabled: true },
    ]);
    const envId = store.createEnvironment("tmp");
    store.updateEnvironmentVariables(envId, [
      { id: "e", key: "host", value: "ENV", enabled: true },
    ]);
    store.setActiveEnvironment(envId);
    store.newTab();
    const tabId = useRequestStore.getState().tabs[0].id;
    store.updateRequest(tabId, { url: "https://{{host}}/get" });
    const tab = useRequestStore.getState().tabs.find((t) => t.id === tabId)!;

    render(<RequestAddressBar tab={tab} />);
    expect(screen.getByText(/解析:/).textContent).toContain("https://ENV/get");
  });
});
