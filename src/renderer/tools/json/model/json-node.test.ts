import { parseTree } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { buildTree, flattenTree, nodeKey } from "./json-node";

describe("buildTree", () => {
  it("构建对象/数组结构并保留大整数字面量", () => {
    const text = '{"id":9123372036854000123,"tags":["a","b"]}';
    const root = buildTree(parseTree(text)!, text);
    expect(root.type).toBe("object");
    expect(root.children).toHaveLength(2);

    const id = root.children[0];
    expect(id.key).toBe("id");
    expect(id.type).toBe("number");
    expect(id.scalarText).toBe("9123372036854000123");

    const tags = root.children[1];
    expect(tags.type).toBe("array");
    expect(tags.children[0].path).toEqual(["tags", 0]);
    expect(tags.children[0].scalarText).toBe("a");
  });
});

describe("flattenTree", () => {
  it("折叠时只产出根行, 展开后含全部后代", () => {
    const text = '{"a":{"b":1}}';
    const root = buildTree(parseTree(text)!, text);

    const collapsed = flattenTree(root, () => false);
    expect(collapsed).toHaveLength(1);

    const expanded = flattenTree(root, () => true);
    expect(expanded.map((row) => row.depth)).toEqual([0, 1, 2]);
  });
});

describe("nodeKey", () => {
  it("同路径稳定, 不同路径相异", () => {
    const text = '{"a":1,"b":1}';
    const root = buildTree(parseTree(text)!, text);
    expect(nodeKey(root.children[0])).toBe(nodeKey(root.children[0]));
    expect(nodeKey(root.children[0])).not.toBe(nodeKey(root.children[1]));
  });
});

describe("buildTree 键范围", () => {
  it("对象成员记录键的源码位置, 数组元素无键范围", () => {
    const text = '{"a":1,"list":[2]}';
    const root = buildTree(parseTree(text)!, text);

    const a = root.children[0];
    expect(text.slice(a.keyOffset!, a.keyOffset! + a.keyLength!)).toBe('"a"');

    const element = root.children[1].children[0]; // list[0]
    expect(element.keyOffset).toBeUndefined();
    expect(element.keyLength).toBeUndefined();
  });
});
