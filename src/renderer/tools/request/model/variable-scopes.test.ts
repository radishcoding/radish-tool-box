import { describe, expect, it } from "vitest";

import { flattenScopes } from "../../../../network/variables";

import {
  buildScopesFromStore,
  itemsToRecord,
  resolveTemplate,
} from "./variable-scopes";

describe("itemsToRecord", () => {
  it("仅收启用且非空键", () => {
    const record = itemsToRecord([
      { id: "1", key: "a", value: "1", enabled: true },
      { id: "2", key: "b", value: "2", enabled: false },
      { id: "3", key: "", value: "x", enabled: true },
      { id: "4", key: "s", value: "secret", enabled: true, kind: "secret" },
    ]);
    expect(record).toEqual({ a: "1", s: "secret" });
  });
});

describe("resolveTemplate", () => {
  it("替换 {{key}} 未知保留", () => {
    expect(resolveTemplate("{{host}}/{{x}}", { host: "a.com" })).toBe(
      "a.com/{{x}}",
    );
  });
});

describe("buildScopesFromStore", () => {
  it("装配 global/collection/environment, local 为空", () => {
    const scopes = buildScopesFromStore(
      [{ id: "1", key: "g", value: "G", enabled: true }],
      {
        id: "e",
        name: "E",
        variables: [{ id: "2", key: "host", value: "x.com", enabled: true }],
      },
      [{ id: "3", key: "c", value: "C", enabled: true }],
    );
    expect(scopes.global).toEqual({ g: "G" });
    expect(scopes.environment).toEqual({ host: "x.com" });
    expect(scopes.collection).toEqual({ c: "C" });
    expect(scopes.local).toEqual({});
  });

  it("无活动环境时 environment 为空", () => {
    const scopes = buildScopesFromStore([], undefined, []);
    expect(scopes.environment).toEqual({});
  });

  it("禁用某作用域的变量后, 该作用域记录不含它", () => {
    const scopes = buildScopesFromStore(
      [{ id: "1", key: "host", value: "GLOBAL", enabled: false }],
      {
        id: "e",
        name: "E",
        variables: [{ id: "2", key: "host", value: "ENV", enabled: false }],
      },
      [{ id: "3", key: "host", value: "COL", enabled: false }],
    );
    expect(scopes.global).toEqual({});
    expect(scopes.environment).toEqual({});
    expect(scopes.collection).toEqual({});
  });

  it("同名变量禁用高优先级作用域时, 解析回退到仍启用的低优先级作用域", () => {
    // environment 的 host 被禁用 -> 回退到仍启用的 global host.
    const flat = flattenScopes(
      buildScopesFromStore(
        [{ id: "1", key: "host", value: "GLOBAL", enabled: true }],
        {
          id: "e",
          name: "E",
          variables: [{ id: "2", key: "host", value: "ENV", enabled: false }],
        },
        [],
      ),
    );
    expect(flat.host).toBe("GLOBAL");
  });

  it("同名变量在所有作用域都禁用时, {{host}} 不被解析 (保留字面量)", () => {
    const flat = flattenScopes(
      buildScopesFromStore(
        [{ id: "1", key: "host", value: "GLOBAL", enabled: false }],
        {
          id: "e",
          name: "E",
          variables: [{ id: "2", key: "host", value: "ENV", enabled: false }],
        },
        [],
      ),
    );
    expect(resolveTemplate("{{host}}/get", flat)).toBe("{{host}}/get");
  });
});
