// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { KeyValueItem } from "./request-channels";
import { mergeQueryParams } from "./url-params";

const item = (key: string, value: string, enabled = true): KeyValueItem => ({
  id: key,
  key,
  value,
  enabled,
});

describe("mergeQueryParams", () => {
  it("把启用参数 append 到已有查询串", () => {
    const url = mergeQueryParams("https://x.com/api?a=1", [
      item("b", "2"),
      item("c", "3"),
    ]);
    expect(url).toBe("https://x.com/api?a=1&b=2&c=3");
  });

  it("跳过禁用项与空键", () => {
    const url = mergeQueryParams("https://x.com/", [
      item("b", "2", false),
      item("", "x"),
      item("d", "4"),
    ]);
    expect(url).toBe("https://x.com/?d=4");
  });

  it("对特殊字符做编码", () => {
    const url = mergeQueryParams("https://x.com/", [item("q", "a b&c")]);
    expect(url).toBe("https://x.com/?q=a+b%26c");
  });

  it("跳过与 URL 查询同名同值的项 (避免 URL/Params 同步后重复)", () => {
    const url = mergeQueryParams("https://x.com/api?a=1&b=2", [
      item("a", "1"),
      item("b", "2"),
      item("c", "3"),
    ]);
    expect(url).toBe("https://x.com/api?a=1&b=2&c=3");
  });
});
