import { parseTree } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { buildTree, nodeKey } from "./json-node";
import { ancestorKeySet, isValidRegex, searchNodes } from "./search";

describe("searchNodes", () => {
  const text = '{"name":"Alice","city":"NYC","tags":["nice"]}';
  const root = buildTree(parseTree(text)!, text);

  it("匹配键与值, 大小写不敏感", () => {
    expect(
      searchNodes(root, "nice", { useRegex: false }).map((n) => n.scalarText),
    ).toEqual(["nice"]);
    expect(
      searchNodes(root, "CITY", { useRegex: false }).map((n) => n.key),
    ).toEqual(["city"]);
  });

  it("正则匹配", () => {
    expect(
      searchNodes(root, "^A", { useRegex: true }).map((n) => n.scalarText),
    ).toEqual(["Alice"]);
  });

  it("无效正则不匹配", () => {
    expect(searchNodes(root, "(", { useRegex: true })).toEqual([]);
    expect(isValidRegex("(")).toBe(false);
  });
});

describe("ancestorKeySet", () => {
  it("保留命中节点及其祖先链", () => {
    const text = '{"a":{"b":{"c":"hit"}}}';
    const root = buildTree(parseTree(text)!, text);
    const keep = ancestorKeySet(
      root,
      searchNodes(root, "hit", { useRegex: false }),
    );
    expect(keep.has(nodeKey(root))).toBe(true);
    expect(keep.size).toBe(4);
  });
});
