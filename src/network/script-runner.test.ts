// @vitest-environment node
import { describe, expect, it } from "vitest";

import { runScript } from "./script-runner";
import type { VariableScopes } from "./request-channels";

const scopes: VariableScopes = {
  global: { g: "G" },
  collection: {},
  environment: { host: "x.com" },
  local: {},
};

const request = { method: "GET", url: "https://x.com", headers: [] };

describe("runScript 前置语义", () => {
  it("pm.environment.set 产生 mutation 且 pm.variables.get 可读回", () => {
    const out = runScript(
      'pm.environment.set("token", "abc"); pm.variables.set("local1", pm.variables.get("token"));',
      { request, scopes },
    );
    expect(out.error).toBe("");
    expect(out.mutations).toContainEqual({
      scope: "environment",
      action: "set",
      key: "token",
      value: "abc",
    });
    expect(out.mutations).toContainEqual({
      scope: "local",
      action: "set",
      key: "local1",
      value: "abc",
    });
  });

  it("pm.variables.get 跨作用域解析 (env 优先于 global)", () => {
    const out = runScript('pm.globals.set("r", pm.variables.get("host"));', {
      request,
      scopes,
    });
    expect(out.mutations).toContainEqual({
      scope: "globals",
      action: "set",
      key: "r",
      value: "x.com",
    });
  });

  it("console.log 被捕获", () => {
    const out = runScript('console.log("hello", 42);', { request, scopes });
    expect(out.logs).toEqual(["hello 42"]);
  });

  it("脚本语法错误归一为 error", () => {
    const out = runScript("this is not valid js !!!", { request, scopes });
    expect(out.error).not.toBe("");
  });
});

describe("runScript 后置语义 (断言 + 响应)", () => {
  const response = {
    code: 200,
    status: "OK",
    responseTime: 12,
    headers: { "content-type": "application/json" },
    body: '{"ok":true,"n":5}',
  };

  it("pm.test 通过与失败被分别记录", () => {
    const out = runScript(
      `pm.test("状态 200", function () { pm.expect(pm.response.code).to.equal(200); });
       pm.test("会失败", function () { pm.expect(1).to.equal(2); });`,
      { request, response, scopes },
    );
    expect(out.tests).toHaveLength(2);
    expect(out.tests[0]).toMatchObject({ name: "状态 200", passed: true });
    expect(out.tests[1].passed).toBe(false);
    expect(out.tests[1].error).not.toBe("");
  });

  it("pm.response.json() 解析体, pm.response.to.have.status", () => {
    const out = runScript(
      `pm.test("json", function () {
         pm.expect(pm.response.json().n).to.equal(5);
         pm.response.to.have.status(200);
       });`,
      { request, response, scopes },
    );
    expect(out.tests[0].passed).toBe(true);
  });
});

// ── P0: 沙箱边界 ──────────────────────────────────────────────────────────────
describe("runScript 沙箱边界 (P0)", () => {
  it("require / process / module / globalThis.process 均不可达", () => {
    const out = runScript(
      `pm.environment.set("r",  typeof require);
       pm.environment.set("p",  typeof process);
       pm.environment.set("m",  typeof module);
       pm.environment.set("gp", typeof globalThis.process);`,
      { request, scopes },
    );
    expect(out.error).toBe("");
    const vals = Object.fromEntries(
      out.mutations.map((mu) => [mu.key, mu.value]),
    );
    expect(vals["r"]).toBe("undefined");
    expect(vals["p"]).toBe("undefined");
    expect(vals["m"]).toBe("undefined");
    expect(vals["gp"]).toBe("undefined");
  });
});

// ── P0: 5 秒超时 ───────────────────────────────────────────────────────────────
describe("runScript 超时 (P0)", () => {
  it("死循环脚本在约 5s 内返回非空 error", { timeout: 8000 }, () => {
    const out = runScript("while(true){}", { request, scopes });
    expect(out.error).not.toBe("");
  });
});

// ── 高: 运行时抛错归一 ──────────────────────────────────────────────────────────
describe("runScript 运行时错误归一", () => {
  it("throw new Error 归一为 error, 已有 tests/mutations 保留", () => {
    const out = runScript(
      `pm.environment.set("before", "1");
       pm.test("pass", function () { pm.expect(1).to.equal(1); });
       throw new Error("x");`,
      { request, scopes },
    );
    expect(out.error).toMatch(/x/);
    expect(out.mutations.some((m) => m.key === "before")).toBe(true);
    expect(out.tests.some((t) => t.name === "pass" && t.passed)).toBe(true);
  });

  it("null.foo 归一为非空 error", () => {
    const out = runScript("null.foo;", { request, scopes });
    expect(out.error).not.toBe("");
  });
});

// ── 高: 头隔离回归 ─────────────────────────────────────────────────────────────
describe("runScript 头隔离 (回归)", () => {
  it("脚本改写 pm.response.headers 不影响传入的原 headers 对象", () => {
    const originalHeaders: Record<string, string | string[]> = {
      "content-type": "application/json",
    };
    const response = {
      code: 200,
      status: "OK",
      responseTime: 5,
      headers: originalHeaders,
      body: "{}",
    };
    runScript(
      `pm.response.headers["x-injected"] = "evil";
       pm.response.headers["content-type"] = "text/plain";`,
      { request, response, scopes },
    );
    // 原对象引用不应被污染.
    expect(originalHeaders["x-injected"]).toBeUndefined();
    expect(originalHeaders["content-type"]).toBe("application/json");
  });
});

// ── 中: 变量作用域 API ──────────────────────────────────────────────────────────
describe("runScript 变量作用域", () => {
  it("pm.globals.get / pm.globals.unset", () => {
    const out = runScript(
      `pm.environment.set("gotG", pm.globals.get("g"));
       pm.globals.unset("g");`,
      { request, scopes },
    );
    expect(out.mutations).toContainEqual({
      scope: "environment",
      action: "set",
      key: "gotG",
      value: "G",
    });
    expect(out.mutations).toContainEqual({
      scope: "globals",
      action: "unset",
      key: "g",
      value: "",
    });
  });

  it("pm.collectionVariables.set / get", () => {
    const out = runScript(
      `pm.collectionVariables.set("cv", "CV");
       pm.environment.set("readBack", pm.collectionVariables.get("cv"));`,
      { request, scopes },
    );
    expect(out.mutations).toContainEqual({
      scope: "collection",
      action: "set",
      key: "cv",
      value: "CV",
    });
    expect(out.mutations).toContainEqual({
      scope: "environment",
      action: "set",
      key: "readBack",
      value: "CV",
    });
  });

  it("pm.variables.get: local 覆盖 environment", () => {
    const overrideScopes: VariableScopes = {
      global: {},
      collection: {},
      environment: { host: "env-val" },
      local: { host: "local-val" },
    };
    const out = runScript(
      `pm.environment.set("resolved", pm.variables.get("host"));`,
      { request, scopes: overrideScopes },
    );
    expect(out.mutations).toContainEqual({
      scope: "environment",
      action: "set",
      key: "resolved",
      value: "local-val",
    });
  });

  it("pm.variables.get: collection 覆盖 globals", () => {
    const overrideScopes: VariableScopes = {
      global: { shared: "global-val" },
      collection: { shared: "col-val" },
      environment: {},
      local: {},
    };
    const out = runScript(
      `pm.environment.set("resolved", pm.variables.get("shared"));`,
      { request, scopes: overrideScopes },
    );
    expect(out.mutations).toContainEqual({
      scope: "environment",
      action: "set",
      key: "resolved",
      value: "col-val",
    });
  });
});

// ── 中: pm.response 工具方法 ───────────────────────────────────────────────────
describe("runScript pm.response 工具", () => {
  it("pm.response.to.be.ok 对 2xx 通过, 非 2xx 使 pm.test 失败", () => {
    const resp2xx = {
      code: 201,
      status: "Created",
      responseTime: 1,
      headers: {},
      body: "",
    };
    const out = runScript(
      `pm.test("ok", function () { pm.response.to.be.ok; });`,
      { request, response: resp2xx, scopes },
    );
    expect(out.tests[0].passed).toBe(true);

    const resp4xx = {
      code: 404,
      status: "Not Found",
      responseTime: 1,
      headers: {},
      body: "",
    };
    const out2 = runScript(
      `pm.test("ok", function () { pm.response.to.be.ok; });`,
      { request, response: resp4xx, scopes },
    );
    expect(out2.tests[0].passed).toBe(false);
  });

  it("pm.response.text() 返回原始体字符串", () => {
    const resp = {
      code: 200,
      status: "OK",
      responseTime: 1,
      headers: {},
      body: "hello world",
    };
    const out = runScript(`pm.environment.set("t", pm.response.text());`, {
      request,
      response: resp,
      scopes,
    });
    expect(out.mutations).toContainEqual({
      scope: "environment",
      action: "set",
      key: "t",
      value: "hello world",
    });
  });

  it("pm.response.json() 对非法 JSON 使 pm.test 失败", () => {
    const resp = {
      code: 200,
      status: "OK",
      responseTime: 1,
      headers: {},
      body: "NOT JSON",
    };
    const out = runScript(
      `pm.test("json", function () { pm.response.json(); });`,
      { request, response: resp, scopes },
    );
    expect(out.tests[0].passed).toBe(false);
  });

  it("console.error / console.warn 进入 logs", () => {
    const out = runScript(
      `console.error("err-msg");
       console.warn("warn-msg");`,
      { request, scopes },
    );
    expect(out.logs).toContain("err-msg");
    expect(out.logs).toContain("warn-msg");
  });
});
