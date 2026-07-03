import type { Node as JsoncNode } from "jsonc-parser";

/**
 * JSON 值的类型标签.
 */
export type JsonValueType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

/**
 * 路径片段: 对象键 (string) 或数组下标 (number).
 */
export type PathSegment = string | number;

/**
 * 解析后的 JSON 节点, 由 jsonc-parser 语法树派生, 携带精确标量与源码位置.
 */
export interface JsonNode {
  readonly type: JsonValueType;
  /**
   * 从根到本节点的路径片段; 根为空数组.
   */
  readonly path: readonly PathSegment[];
  /**
   * 本节点在父级中的键 (对象成员) 或下标 (数组元素); 根为 undefined.
   */
  readonly key: PathSegment | undefined;
  /**
   * 源码起始偏移 (字符).
   */
  readonly offset: number;
  /**
   * 源码长度 (字符).
   */
  readonly length: number;
  /**
   * 成员键的源码起始偏移 (含引号); 仅对象成员有, 数组元素与根为 undefined.
   */
  readonly keyOffset: number | undefined;
  /**
   * 成员键的源码长度 (含引号).
   */
  readonly keyLength: number | undefined;
  /**
   * 子节点, 顺序与源码一致; 标量为空数组.
   */
  readonly children: readonly JsonNode[];
  /**
   * 标量精确文本: string 为去引号后的内容, number 为源码切片 (保精度), boolean/null 为字面量; 容器为 undefined.
   */
  readonly scalarText: string | undefined;
}

/**
 * 树拍平后的一行 (供虚拟化渲染).
 */
export interface VisibleRow {
  readonly node: JsonNode;
  readonly depth: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
}

/**
 * 由 jsonc-parser 语法树根构建带精确标量与位置的 JsonNode 树.
 */
export function buildTree(root: JsoncNode, text: string): JsonNode {
  return fromValueNode(root, undefined, [], text);
}

/**
 * 把树按当前展开态前序拍平成可见行序列.
 */
export function flattenTree(
  root: JsonNode,
  isExpanded: (node: JsonNode) => boolean,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (node: JsonNode, depth: number): void => {
    const expandable = node.children.length > 0;
    const expanded = expandable && isExpanded(node);
    rows.push({ node, depth, expandable, expanded });
    if (expanded) {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  };
  walk(root, 0);
  return rows;
}

/**
 * 节点的稳定标识 (基于路径), 供展开态/命中集等以集合记录.
 */
export function nodeKey(node: JsonNode): string {
  return JSON.stringify(node.path);
}

/**
 * 递归构建单个值节点; jsonc 的 object 子节点是 property, 需取其 [键, 值].
 */
function fromValueNode(
  node: JsoncNode,
  key: PathSegment | undefined,
  path: readonly PathSegment[],
  text: string,
  keyRange?: { readonly offset: number; readonly length: number },
): JsonNode {
  const type = node.type as JsonValueType;
  const children: JsonNode[] = [];

  if (type === "object") {
    for (const property of node.children ?? []) {
      const keyNode = property.children?.[0];
      const valueNode = property.children?.[1];
      if (keyNode === undefined || valueNode === undefined) {
        continue;
      }
      const childKey = String(keyNode.value);
      children.push(
        fromValueNode(valueNode, childKey, [...path, childKey], text, {
          offset: keyNode.offset,
          length: keyNode.length,
        }),
      );
    }
  } else if (type === "array") {
    (node.children ?? []).forEach((element, index) => {
      children.push(fromValueNode(element, index, [...path, index], text));
    });
  }

  return {
    type,
    path,
    key,
    offset: node.offset,
    length: node.length,
    keyOffset: keyRange?.offset,
    keyLength: keyRange?.length,
    children,
    scalarText:
      type === "object" || type === "array"
        ? undefined
        : scalarTextOf(node, type, text),
  };
}

/**
 * 取标量节点的精确文本.
 */
function scalarTextOf(
  node: JsoncNode,
  type: JsonValueType,
  text: string,
): string {
  if (type === "number") {
    // 直接取源码切片, 保留 int64 等精确字面量
    return text.slice(node.offset, node.offset + node.length);
  }
  // string 已由 jsonc 解码; boolean/null 取其字面值
  return String(node.value);
}
