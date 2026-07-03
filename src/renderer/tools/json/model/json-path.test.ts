import { describe, expect, it } from "vitest";

import { formatPath } from "./json-path";

describe("formatPath", () => {
  const path = ["users", 0, "first-name"] as const;

  it("JS 访问器风格 (无 root, 首段不带前导点)", () => {
    expect(formatPath(path, "js")).toBe('users[0]["first-name"]');
    expect(formatPath(["key"], "js")).toBe("key");
  });

  it("JSONPath 风格", () => {
    expect(formatPath(path, "jsonpath")).toBe('$.users[0]["first-name"]');
  });

  it("JSON Pointer 风格", () => {
    expect(formatPath(path, "pointer")).toBe("/users/0/first-name");
  });

  it("根路径", () => {
    expect(formatPath([], "js")).toBe("");
    expect(formatPath([], "jsonpath")).toBe("$");
    expect(formatPath([], "pointer")).toBe("");
  });

  it("Pointer 转义 ~ 与 /", () => {
    expect(formatPath(["a/b", "c~d"], "pointer")).toBe("/a~1b/c~0d");
  });
});
