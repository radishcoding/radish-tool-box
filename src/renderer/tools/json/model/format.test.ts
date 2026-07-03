import { parse } from "lossless-json";
import { describe, expect, it } from "vitest";

import {
  formatJson,
  minifyJson,
  minifyValue,
  sortKeysJson,
  sortValueKeys,
  stringifyValue,
} from "./format";

describe("format", () => {
  it("美化并保留大整数精度", () => {
    expect(formatJson('{"id":9123372036854000123}')).toBe(
      '{\n  "id": 9123372036854000123\n}',
    );
  });

  it("压缩成单行", () => {
    expect(minifyJson('{\n  "a": 1\n}')).toBe('{"a":1}');
  });

  it("按键名递归排序", () => {
    expect(sortKeysJson('{"b":1,"a":{"d":2,"c":3}}')).toBe(
      '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}',
    );
  });
});

describe("format 值版本", () => {
  it("stringifyValue 美化并保留大数", () => {
    expect(stringifyValue(parse('{"id":9123372036854000123}'))).toBe(
      '{\n  "id": 9123372036854000123\n}',
    );
  });

  it("minifyValue 压缩", () => {
    expect(minifyValue(parse('{"a":1,"b":2}'))).toBe('{"a":1,"b":2}');
  });

  it("sortValueKeys 递归排序后可序列化", () => {
    expect(stringifyValue(sortValueKeys(parse('{"b":1,"a":2}')))).toBe(
      '{\n  "a": 2,\n  "b": 1\n}',
    );
  });
});
