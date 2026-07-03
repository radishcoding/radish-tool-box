import { parseTree } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { buildTree } from "./json-node";
import { nodeValue } from "./node-value";

describe("nodeValue", () => {
  it("容器返回子树原文切片, 语言为 json", () => {
    const text = '{"a":{"x":1}}';
    const root = buildTree(parseTree(text)!, text);
    expect(nodeValue(root.children[0], text)).toEqual({
      text: '{"x":1}',
      language: "json",
    });
  });

  it("字符串返回内容文本, 语言为 plaintext", () => {
    const text = '{"s":"hi"}';
    const root = buildTree(parseTree(text)!, text);
    expect(nodeValue(root.children[0], text)).toEqual({
      text: "hi",
      language: "plaintext",
    });
  });

  it("数字返回精确字面量", () => {
    const text = '{"n":9123372036854000123}';
    const root = buildTree(parseTree(text)!, text);
    expect(nodeValue(root.children[0], text).text).toBe("9123372036854000123");
  });
});
