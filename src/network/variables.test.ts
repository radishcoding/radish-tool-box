// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { VariableScopes } from "./request-channels";
import { flattenScopes, resolveTemplate } from "./variables";

const scopes = (over: Partial<VariableScopes>): VariableScopes => ({
  global: {},
  collection: {},
  environment: {},
  local: {},
  ...over,
});

describe("flattenScopes", () => {
  it("local 覆盖 environment 覆盖 collection 覆盖 global", () => {
    const flat = flattenScopes(
      scopes({
        global: { a: "g", b: "g", c: "g", d: "g" },
        collection: { b: "c", c: "c", d: "c" },
        environment: { c: "e", d: "e" },
        local: { d: "l" },
      }),
    );
    expect(flat).toEqual({ a: "g", b: "c", c: "e", d: "l" });
  });
});

describe("resolveTemplate", () => {
  it("替换已知变量", () => {
    expect(resolveTemplate("{{host}}/api", { host: "x.com" })).toBe(
      "x.com/api",
    );
  });

  it("未知变量原样保留", () => {
    expect(resolveTemplate("{{missing}}", {})).toBe("{{missing}}");
  });

  it("容忍变量名两侧空格", () => {
    expect(resolveTemplate("{{ host }}", { host: "x" })).toBe("x");
  });
});
