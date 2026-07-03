import { describe, expect, it } from "vitest";

import {
  escapeToJsonString,
  tryParseStringAsJson,
  unescapeJsonString,
} from "./escape";

describe("escape", () => {
  it("转义包裹与去转义往返", () => {
    const raw = '{"a":1}';
    const escaped = escapeToJsonString(raw);
    expect(escaped).toBe('"{\\"a\\":1}"');
    expect(unescapeJsonString(escaped)).toBe(raw);
  });

  it("去转义非字符串字面量则原样返回", () => {
    expect(unescapeJsonString("{not a string}")).toBe("{not a string}");
  });

  it("解包内嵌 JSON 字符串", () => {
    expect(tryParseStringAsJson('{"x":1}')).toBe('{"x":1}');
    expect(tryParseStringAsJson("not json")).toBeUndefined();
  });
});
