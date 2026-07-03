import { parseTree } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { buildTree, nodeKey } from "./json-node";
import { findNodeAtOffset, findNodeByKey, nodeRange } from "./offset-mapping";

describe("findNodeAtOffset", () => {
  const text = '{"a":{"b":42}}';
  const root = buildTree(parseTree(text)!, text);

  it("定位到最深的包含节点", () => {
    const node = findNodeAtOffset(root, text.indexOf("42"), text);
    expect(node?.scalarText).toBe("42");
    expect(node?.path).toEqual(["a", "b"]);
  });

  it("区间外返回 undefined", () => {
    expect(findNodeAtOffset(root, text.length + 5, text)).toBeUndefined();
  });

  it("点击键名定位到该成员的值节点", () => {
    const keyed = '{"a":{"b":1}}';
    const keyedRoot = buildTree(parseTree(keyed)!, keyed);
    expect(
      findNodeAtOffset(keyedRoot, keyed.indexOf('"a"') + 1, keyed)?.path,
    ).toEqual(["a"]);
    expect(
      findNodeAtOffset(keyedRoot, keyed.indexOf('"b"') + 1, keyed)?.path,
    ).toEqual(["a", "b"]);
    expect(
      findNodeAtOffset(keyedRoot, keyed.indexOf("1"), keyed)?.path,
    ).toEqual(["a", "b"]);
  });

  it("光标落在成员值之后的间隙 (逗号/行尾) 归属到该成员", () => {
    const formatted = '{\n  "a": 1,\n  "b": 2\n}';
    const formattedRoot = buildTree(parseTree(formatted)!, formatted);
    const afterComma = formatted.indexOf(",") + 1;
    expect(
      findNodeAtOffset(formattedRoot, afterComma, formatted)?.path,
    ).toEqual(["a"]);
  });

  it("光标落在纯括号行保持为容器", () => {
    const nested = '{\n  "a": {\n    "b": 1\n  }\n}';
    const nestedRoot = buildTree(parseTree(nested)!, nested);
    const innerClose = nested.indexOf("}"); // a 对象的闭合括号 (单独成行)
    expect(findNodeAtOffset(nestedRoot, innerClose, nested)?.path).toEqual([
      "a",
    ]);
  });
});

describe("nodeRange", () => {
  it("返回 [offset, offset+length)", () => {
    const text = '{"a":42}';
    const root = buildTree(parseTree(text)!, text);
    const range = nodeRange(root.children[0]);
    expect(text.slice(range.start, range.end)).toBe("42");
  });
});

describe("findNodeByKey", () => {
  const text = '{"a":{"b":[1,2]}}';
  const root = buildTree(parseTree(text)!, text);

  it("按 nodeKey 定位节点", () => {
    const target = root.children[0].children[0].children[1]; // a.b[1]
    expect(findNodeByKey(root, nodeKey(target))?.scalarText).toBe("2");
  });

  it("不存在返回 undefined", () => {
    expect(findNodeByKey(root, JSON.stringify(["x"]))).toBeUndefined();
  });
});
