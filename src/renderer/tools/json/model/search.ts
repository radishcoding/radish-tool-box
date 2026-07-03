import { nodeKey, type JsonNode } from "./json-node";

/**
 * 搜索选项.
 */
export interface SearchOptions {
  readonly useRegex: boolean;
}

/**
 * 匹配函数: 命中文本返回 true.
 */
type Matcher = (text: string) => boolean;

/**
 * 搜索命中节点 (匹配键名或标量值文本), 前序返回; 空查询或无效正则返回空数组.
 */
export function searchNodes(
  root: JsonNode,
  query: string,
  options: SearchOptions,
): JsonNode[] {
  const matcher = buildMatcher(query, options);
  if (!matcher) {
    return [];
  }
  const hits: JsonNode[] = [];
  const walk = (node: JsonNode): void => {
    if (matchesNode(node, matcher)) {
      hits.push(node);
    }
    node.children.forEach(walk);
  };
  walk(root);
  return hits;
}

/**
 * 命中节点及其全部祖先的标识集合 (供过滤模式保留祖先链).
 */
export function ancestorKeySet(
  root: JsonNode,
  hits: readonly JsonNode[],
): Set<string> {
  const keep = new Set<string>();
  const hitKeys = new Set(hits.map(nodeKey));
  const walk = (node: JsonNode): boolean => {
    let keepThis = hitKeys.has(nodeKey(node));
    for (const child of node.children) {
      if (walk(child)) {
        keepThis = true;
      }
    }
    if (keepThis) {
      keep.add(nodeKey(node));
    }
    return keepThis;
  };
  walk(root);
  return keep;
}

/**
 * 校验正则是否合法.
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * 据查询与选项构建匹配器; 空查询或无效正则返回 undefined.
 */
function buildMatcher(
  query: string,
  options: SearchOptions,
): Matcher | undefined {
  if (query === "") {
    return undefined;
  }
  if (options.useRegex) {
    try {
      const regex = new RegExp(query, "i");
      return (text) => regex.test(text);
    } catch {
      return undefined;
    }
  }
  const needle = query.toLowerCase();
  return (text) => text.toLowerCase().includes(needle);
}

/**
 * 节点的键或标量值是否命中.
 */
function matchesNode(node: JsonNode, matcher: Matcher): boolean {
  if (node.key !== undefined && matcher(String(node.key))) {
    return true;
  }
  return node.scalarText !== undefined && matcher(node.scalarText);
}
