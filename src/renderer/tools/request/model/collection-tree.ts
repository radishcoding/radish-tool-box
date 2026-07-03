import type { HttpRequest } from "./types";

/**
 * 集合中的文件夹节点 (可嵌套).
 */
export interface CollectionFolder {
  readonly id: string;
  readonly type: "folder";
  readonly name: string;
  readonly children: readonly CollectionNode[];
}

/**
 * 集合中的请求节点.
 */
export interface CollectionRequestNode {
  readonly id: string;
  readonly type: "request";
  readonly name: string;
  readonly request: HttpRequest;
}

/**
 * 集合树节点 (文件夹或请求).
 */
export type CollectionNode = CollectionFolder | CollectionRequestNode;

/**
 * 递归展平所有文件夹为 {id, label} 列表, label 为从顶层到该文件夹的路径 (用 / 连接).
 * 供保存对话框选择目标文件夹.
 * @param nodes 节点列表.
 * @param prefix 上层路径前缀 (递归内部用, 外部调用留空).
 * @returns 文件夹的 id 与路径标签列表 (深度优先顺序).
 */
export function flattenFolders(
  nodes: readonly CollectionNode[],
  prefix = "",
): readonly { readonly id: string; readonly label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      const label = prefix === "" ? node.name : `${prefix} / ${node.name}`;
      out.push({ id: node.id, label });
      out.push(...flattenFolders(node.children, label));
    }
  }
  return out;
}

/**
 * 取指定父级下的直接子节点.
 * @param nodes 集合顶层节点列表.
 * @param parentId 目标父文件夹 id; undefined 表示集合根 (返回顶层节点).
 * @returns 该父级下的直接子节点; 父级不存在或非文件夹时返回空数组.
 */
export function childrenAt(
  nodes: readonly CollectionNode[],
  parentId: string | undefined,
): readonly CollectionNode[] {
  if (parentId === undefined) {
    return nodes;
  }
  const parent = findNode(nodes, parentId);
  return parent !== undefined && parent.type === "folder"
    ? parent.children
    : [];
}

/**
 * 在指定父级下查找同名请求节点 (仅比对请求, 不含文件夹).
 * @param nodes 集合顶层节点列表.
 * @param parentId 目标父文件夹 id; undefined 表示集合根.
 * @param name 请求名.
 * @returns 命中的同名请求节点, 或 undefined.
 */
export function findRequestByName(
  nodes: readonly CollectionNode[],
  parentId: string | undefined,
  name: string,
): CollectionRequestNode | undefined {
  return childrenAt(nodes, parentId).find(
    (node): node is CollectionRequestNode =>
      node.type === "request" && node.name === name,
  );
}

/**
 * 递归查找指定 id 的节点.
 * @param nodes 节点列表.
 * @param id 目标 id.
 * @returns 命中的节点, 或 undefined.
 */
export function findNode(
  nodes: readonly CollectionNode[],
  id: string,
): CollectionNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.type === "folder") {
      const found = findNode(node.children, id);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * 把节点插入树: parentId 为 undefined 时追加到顶层, 否则插入该文件夹的 children.
 * @param nodes 节点列表.
 * @param parentId 目标父文件夹 id (undefined 表示顶层).
 * @param node 待插入节点.
 * @returns 新树.
 */
export function insertNode(
  nodes: readonly CollectionNode[],
  parentId: string | undefined,
  node: CollectionNode,
): readonly CollectionNode[] {
  if (parentId === undefined) {
    return [...nodes, node];
  }
  return nodes.map((current) => {
    if (current.id === parentId && current.type === "folder") {
      return { ...current, children: [...current.children, node] };
    }
    if (current.type === "folder") {
      return {
        ...current,
        children: insertNode(current.children, parentId, node),
      };
    }
    return current;
  });
}

/**
 * 递归移除指定 id 的节点.
 * @param nodes 节点列表.
 * @param id 目标 id.
 * @returns 新树.
 */
export function removeNode(
  nodes: readonly CollectionNode[],
  id: string,
): readonly CollectionNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.type === "folder"
        ? { ...node, children: removeNode(node.children, id) }
        : node,
    );
}

/**
 * 递归改名指定 id 的节点.
 * @param nodes 节点列表.
 * @param id 目标 id.
 * @param name 新名称.
 * @returns 新树.
 */
export function renameNode(
  nodes: readonly CollectionNode[],
  id: string,
  name: string,
): readonly CollectionNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, name };
    }
    if (node.type === "folder") {
      return { ...node, children: renameNode(node.children, id, name) };
    }
    return node;
  });
}

/**
 * 递归替换指定请求节点的 request.
 * @param nodes 节点列表.
 * @param id 目标请求节点 id.
 * @param request 新请求.
 * @returns 新树.
 */
export function replaceRequest(
  nodes: readonly CollectionNode[],
  id: string,
  request: HttpRequest,
): readonly CollectionNode[] {
  return nodes.map((node) => {
    if (node.id === id && node.type === "request") {
      return { ...node, request };
    }
    if (node.type === "folder") {
      return { ...node, children: replaceRequest(node.children, id, request) };
    }
    return node;
  });
}
