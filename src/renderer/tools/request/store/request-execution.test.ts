import { beforeEach, describe, expect, it } from "vitest";

import type { StreamEvent } from "../model/types";
import { useRequestStore } from "./request-store";

function reset(): void {
  useRequestStore.setState({
    tabs: [],
    activeTabId: undefined,
    sidebarSection: "collections",
    responses: {},
    jobToTab: {},
  });
}

const ev = (
  jobId: string,
  kind: StreamEvent["kind"],
  payload: unknown,
): StreamEvent => ({
  jobId,
  kind,
  payload,
});

describe("store 执行切片", () => {
  beforeEach(reset);

  it("startRequest 建立 running 响应并登记 jobToTab", () => {
    useRequestStore.getState().startRequest("t1", "j1");
    const s = useRequestStore.getState();
    expect(s.responses["t1"].phase).toBe("running");
    expect(s.responses["t1"].jobId).toBe("j1");
    expect(s.jobToTab["j1"]).toBe("t1");
  });

  it("applyDriverEvent 按事件累积状态/头/块/耗时并以 end 收尾", () => {
    const store = useRequestStore.getState();
    store.startRequest("t1", "j1");
    store.applyDriverEvent(
      ev("j1", "status", {
        statusCode: 200,
        statusText: "OK",
        httpVersion: "1.1",
      }),
    );
    store.applyDriverEvent(
      ev("j1", "headers", { "content-type": "application/json" }),
    );
    store.applyDriverEvent(ev("j1", "chunk", { base64: "QQ==" }));
    store.applyDriverEvent(ev("j1", "metric", { totalMs: 42 }));
    store.applyDriverEvent(ev("j1", "end", { ok: true }));
    const r = useRequestStore.getState().responses["t1"];
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.chunks).toEqual(["QQ=="]);
    expect(r.timeMs).toBe(42);
    expect(r.phase).toBe("done");
  });

  it("error 事件置 error 阶段与信息", () => {
    const store = useRequestStore.getState();
    store.startRequest("t1", "j1");
    store.applyDriverEvent(ev("j1", "error", { message: "连接被拒绝" }));
    const r = useRequestStore.getState().responses["t1"];
    expect(r.phase).toBe("error");
    expect(r.error).toBe("连接被拒绝");
  });

  it("cookie 事件跨跳累积 Set-Cookie", () => {
    const store = useRequestStore.getState();
    store.startRequest("t1", "j1");
    store.applyDriverEvent(
      ev("j1", "cookie", { setCookie: ["sid=abc; Path=/"] }),
    );
    store.applyDriverEvent(ev("j1", "cookie", { setCookie: ["theme=dark"] }));
    const r = useRequestStore.getState().responses["t1"];
    expect(r.cookies).toEqual(["sid=abc; Path=/", "theme=dark"]);
  });

  it("cookie 事件的 sent 覆盖为最终跳带出的 Cookie 头", () => {
    const store = useRequestStore.getState();
    store.startRequest("t1", "j1");
    store.applyDriverEvent(ev("j1", "cookie", { sent: "foo=old" }));
    store.applyDriverEvent(ev("j1", "cookie", { sent: "foo=bar; a=1" }));
    const r = useRequestStore.getState().responses["t1"];
    expect(r.sentCookie).toBe("foo=bar; a=1");
    // sent 事件不应污染 setCookie 累积.
    expect(r.cookies).toEqual([]);
  });

  it("未知 jobId 的事件被忽略", () => {
    useRequestStore
      .getState()
      .applyDriverEvent(ev("ghost", "end", { ok: true }));
    expect(useRequestStore.getState().responses).toEqual({});
  });

  it("markCancelled 把 running 响应置为 cancelled", () => {
    const store = useRequestStore.getState();
    store.startRequest("t1", "j1");
    store.markCancelled("t1");
    const r = useRequestStore.getState().responses["t1"];
    expect(r.phase).toBe("cancelled");
    expect(r.error).toBe("已取消");
  });

  it("serialize 不含 responses/jobToTab", () => {
    const store = useRequestStore.getState();
    store.newTab();
    store.startRequest("t1", "j1");
    const keys = Object.keys(useRequestStore.getState().serialize());
    expect(keys).not.toContain("responses");
    expect(keys).not.toContain("jobToTab");
  });

  // ── 高: applyDriverEvent jobId 不匹配被拒 ─────────────────────────────────
  it("applyDriverEvent: tab 存在但 responses[tabId].jobId 已被新请求覆盖, 旧事件被拒", () => {
    const store = useRequestStore.getState();
    // 发起旧请求.
    store.startRequest("t1", "old-job");
    // 模拟重发: 用新 jobId 覆盖 responses[t1], 同时新 jobId 注册到 jobToTab.
    store.startRequest("t1", "new-job");
    // 确保旧 jobId 仍在 jobToTab (真实场景旧条目可能残留).
    useRequestStore.setState((s) => ({
      jobToTab: { ...s.jobToTab, "old-job": "t1" },
    }));
    // 当前响应 jobId 已是 new-job.
    expect(useRequestStore.getState().responses["t1"].jobId).toBe("new-job");
    // 用旧 jobId 发 end 事件.
    store.applyDriverEvent(ev("old-job", "end", { ok: true }));
    // phase 应仍为 running, 而非被旧事件置为 done.
    expect(useRequestStore.getState().responses["t1"].phase).toBe("running");
  });
});
