import { describe, expect, it } from "vitest";

import {
  childrenAt,
  findNode,
  findRequestByName,
  flattenFolders,
  insertNode,
  removeNode,
  renameNode,
  replaceRequest,
  type CollectionNode,
} from "./collection-tree";
import { createDefaultRequest } from "./types";

const req = createDefaultRequest();

function folder(id: string, children: CollectionNode[] = []): CollectionNode {
  return { id, type: "folder", name: id, children };
}
function reqNode(id: string): CollectionNode {
  return { id, type: "request", name: id, request: req };
}

describe("collection-tree", () => {
  it("insertNode 顶层追加", () => {
    const nodes = insertNode([], undefined, reqNode("a"));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("a");
  });

  it("insertNode 插入指定文件夹的 children", () => {
    const tree = [folder("f1")];
    const next = insertNode(tree, "f1", reqNode("a"));
    const f1 = findNode(next, "f1");
    expect(f1?.type === "folder" && f1.children).toHaveLength(1);
  });

  it("flattenFolders 展平文件夹为路径标签, 跳过请求节点", () => {
    const tree = [
      folder("f1", [reqNode("r1"), folder("f2", [folder("f3")])]),
      reqNode("top"),
    ];
    expect(flattenFolders(tree)).toEqual([
      { id: "f1", label: "f1" },
      { id: "f2", label: "f1 / f2" },
      { id: "f3", label: "f1 / f2 / f3" },
    ]);
  });

  it("flattenFolders 空树返回空", () => {
    expect(flattenFolders([])).toEqual([]);
  });

  it("findNode 递归查找深层节点", () => {
    const tree = [folder("f1", [folder("f2", [reqNode("deep")])])];
    expect(findNode(tree, "deep")?.id).toBe("deep");
    expect(findNode(tree, "missing")).toBeUndefined();
  });

  it("removeNode 递归移除", () => {
    const tree = [folder("f1", [reqNode("a"), reqNode("b")])];
    const next = removeNode(tree, "a");
    const f1 = findNode(next, "f1");
    expect(f1?.type === "folder" && f1.children).toHaveLength(1);
    expect(findNode(next, "a")).toBeUndefined();
  });

  it("renameNode 递归改名", () => {
    const tree = [folder("f1", [reqNode("a")])];
    const next = renameNode(tree, "a", "登录");
    expect(findNode(next, "a")?.name).toBe("登录");
  });

  it("replaceRequest 更新请求节点的 request", () => {
    const tree = [reqNode("a")];
    const updated = { ...req, url: "https://x.com" };
    const next = replaceRequest(tree, "a", updated);
    const node = findNode(next, "a");
    expect(node?.type === "request" && node.request.url).toBe("https://x.com");
  });

  it("childrenAt 根级返回顶层, 指定文件夹返回其 children", () => {
    const tree = [folder("f1", [reqNode("a"), reqNode("b")]), reqNode("top")];
    // 根级 (undefined) 返回顶层节点.
    expect(childrenAt(tree, undefined).map((n) => n.id)).toEqual(["f1", "top"]);
    // 指定文件夹返回其直接子节点.
    expect(childrenAt(tree, "f1").map((n) => n.id)).toEqual(["a", "b"]);
    // 不存在的父级返回空.
    expect(childrenAt(tree, "missing")).toEqual([]);
  });

  it("findRequestByName 命中同名请求, 忽略文件夹与他级", () => {
    const named = (id: string, name: string): CollectionNode => ({
      id,
      type: "request",
      name,
      request: req,
    });
    const tree = [
      folder("f1", [named("r-in", "登录"), named("r-x", "x")]),
      named("r-root", "登录"),
    ];
    // 根级名为 "登录" 的请求命中根级节点.
    expect(findRequestByName(tree, undefined, "登录")?.id).toBe("r-root");
    // f1 内名为 "登录" 的请求命中文件夹内节点.
    expect(findRequestByName(tree, "f1", "登录")?.id).toBe("r-in");
    // 根级无名为 x 的请求 (x 在 f1 内).
    expect(findRequestByName(tree, undefined, "x")).toBeUndefined();
    // 文件夹名不参与请求同名比对.
    expect(findRequestByName(tree, undefined, "f1")).toBeUndefined();
  });

  it("不可变: 原树不被修改", () => {
    const tree = [folder("f1", [reqNode("a")])];
    renameNode(tree, "a", "改了");
    expect(findNode(tree, "a")?.name).toBe("a");
  });
});
