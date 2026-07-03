import type { JsonNode, PathSegment } from "./json-node";

/**
 * 偏移是否落在节点的值范围内.
 */
function inValueRange(node: JsonNode, offset: number): boolean {
  return offset >= node.offset && offset <= node.offset + node.length;
}

/**
 * 偏移是否落在对象成员的键范围内.
 */
function inKeyRange(node: JsonNode, offset: number): boolean {
  if (node.keyOffset === undefined || node.keyLength === undefined) {
    return false;
  }
  return offset >= node.keyOffset && offset <= node.keyOffset + node.keyLength;
}

/**
 * 节点跨度起点 (对象成员含键).
 */
function spanStart(node: JsonNode): number {
  return node.keyOffset ?? node.offset;
}

/**
 * 节点跨度终点 (值末尾).
 */
function spanEnd(node: JsonNode): number {
  return node.offset + node.length;
}

/**
 * 偏移到节点跨度的距离 (落在跨度内为 0).
 */
function distanceToSpan(node: JsonNode, offset: number): number {
  const start = spanStart(node);
  const end = spanEnd(node);
  if (offset < start) {
    return start - offset;
  }
  if (offset > end) {
    return offset - end;
  }
  return 0;
}

/**
 * 偏移所在行的 [起, 止); 止为该行换行符位置或文本末尾.
 */
function lineBounds(
  text: string,
  offset: number,
): { readonly start: number; readonly end: number } {
  let start = offset;
  while (start > 0 && text[start - 1] !== "\n") {
    start -= 1;
  }
  let end = offset;
  while (end < text.length && text[end] !== "\n") {
    end += 1;
  }
  return { start, end };
}

/**
 * 找到光标偏移对应的节点 (值范围或键范围); 偏移落在根值范围外则返回 undefined.
 *
 * 当偏移落在容器内成员之间的间隙 (如逗号后/行尾) 时, 归属到与光标同一行的成员/元素;
 * 同一行无成员 (如纯括号行) 则保持为该容器. 这样光标在任意位置都能解析到合适的值.
 */
export function findNodeAtOffset(
  root: JsonNode,
  offset: number,
  text: string,
): JsonNode | undefined {
  if (!inValueRange(root, offset)) {
    return undefined;
  }
  let current: JsonNode = root;
  for (;;) {
    // 落在某子节点的值范围内 → 下钻
    const inValue = current.children.find((child) =>
      inValueRange(child, offset),
    );
    if (inValue) {
      current = inValue;
      continue;
    }
    // 落在某子成员的键范围内 → 该成员即结果 (不再下钻)
    const onKey = current.children.find((child) => inKeyRange(child, offset));
    if (onKey) {
      return onKey;
    }
    if (current.children.length === 0) {
      return current;
    }
    const line = lineBounds(text, offset);
    const onLine = current.children.filter(
      (child) => spanStart(child) < line.end && spanEnd(child) > line.start,
    );
    if (onLine.length === 0) {
      return current;
    }
    let nearest = onLine[0];
    let best = distanceToSpan(nearest, offset);
    for (const child of onLine) {
      const distance = distanceToSpan(child, offset);
      if (distance < best) {
        best = distance;
        nearest = child;
      }
    }
    return nearest;
  }
}

/**
 * 节点对应的源码区间 [start, end).
 */
export function nodeRange(node: JsonNode): {
  readonly start: number;
  readonly end: number;
} {
  return { start: node.offset, end: node.offset + node.length };
}

/**
 * 按 nodeKey (路径的 JSON 串) 在树中定位节点; 不存在返回 undefined.
 */
export function findNodeByKey(
  root: JsonNode,
  key: string,
): JsonNode | undefined {
  const path = JSON.parse(key) as PathSegment[];
  let current: JsonNode | undefined = root;
  for (const segment of path) {
    if (!current) {
      return undefined;
    }
    current = current.children.find((child) => child.key === segment);
  }
  return current;
}
