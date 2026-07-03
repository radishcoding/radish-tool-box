import type { PathSegment } from "./json-node";

/**
 * 路径表示法.
 */
export type PathFormat = "js" | "jsonpath" | "pointer";

/**
 * 合法 JS 标识符 (可用点访问).
 */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * 把路径片段序列格式化为指定表示法的字符串.
 */
export function formatPath(
  path: readonly PathSegment[],
  format: PathFormat,
): string {
  switch (format) {
    case "jsonpath":
      return bracketStyle(path, "$");
    case "pointer":
      return pointerStyle(path);
    case "js":
    default:
      return jsAccessorStyle(path);
  }
}

/**
 * JS 访问器风格: 无根记号; 首段为标识符时不带前导点 (如 key.sub[0]["a-b"]).
 */
function jsAccessorStyle(path: readonly PathSegment[]): string {
  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
    } else if (IDENTIFIER.test(segment)) {
      out += out === "" ? segment : `.${segment}`;
    } else {
      out += `[${JSON.stringify(segment)}]`;
    }
  }
  return out;
}

/**
 * 点 + 方括号风格 (JSONPath, 带 $ 根记号).
 */
function bracketStyle(path: readonly PathSegment[], rootToken: string): string {
  let out = rootToken;
  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
    } else if (IDENTIFIER.test(segment)) {
      out += `.${segment}`;
    } else {
      out += `[${JSON.stringify(segment)}]`;
    }
  }
  return out;
}

/**
 * RFC 6901 JSON Pointer 风格.
 */
function pointerStyle(path: readonly PathSegment[]): string {
  if (path.length === 0) {
    return "";
  }
  return `/${path.map((segment) => escapePointer(String(segment))).join("/")}`;
}

/**
 * Pointer 片段转义: ~ -> ~0, / -> ~1.
 */
function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
