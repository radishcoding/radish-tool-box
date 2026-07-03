import { parse } from "lossless-json";

/**
 * 把文本转义包裹为一个 JSON 字符串字面量 (含外层引号).
 */
export function escapeToJsonString(text: string): string {
  return JSON.stringify(text);
}

/**
 * 去转义: 把一个 JSON 字符串字面量解包为其内容; 非字符串字面量则原样返回.
 */
export function unescapeJsonString(text: string): string {
  try {
    const value: unknown = JSON.parse(text.trim());
    return typeof value === "string" ? value : text;
  } catch {
    return text;
  }
}

/**
 * 尝试把一段内容解析为 JSON: 成功返回原内容 (供调用方再格式化), 失败返回 undefined.
 */
export function tryParseStringAsJson(content: string): string | undefined {
  try {
    parse(content);
    return content;
  } catch {
    return undefined;
  }
}
