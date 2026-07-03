import { isLosslessNumber, parse, stringify } from "lossless-json";

/**
 * 序列化值为美化文本 (默认 2 空格), 保留大数精度.
 */
export function stringifyValue(value: unknown, indent: number = 2): string {
  return stringify(value, undefined, indent) ?? "";
}

/**
 * 序列化值为无空白单行.
 */
export function minifyValue(value: unknown): string {
  return stringify(value) ?? "";
}

/**
 * 递归对对象键排序; 数组保序; LosslessNumber 等标量原样返回.
 */
export function sortValueKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValueKeys);
  }
  if (value !== null && typeof value === "object" && !isLosslessNumber(value)) {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    const out: Record<string, unknown> = {};
    for (const [key, child] of entries) {
      out[key] = sortValueKeys(child);
    }
    return out;
  }
  return value;
}

/**
 * 美化: 按指定缩进重排 (默认 2 空格), 保留大数精度.
 */
export function formatJson(text: string, indent: number = 2): string {
  return stringifyValue(parse(text), indent);
}

/**
 * 压缩: 序列化为无空白单行.
 */
export function minifyJson(text: string): string {
  return minifyValue(parse(text));
}

/**
 * 按键名递归排序后重排 (默认 2 空格).
 */
export function sortKeysJson(text: string, indent: number = 2): string {
  return stringifyValue(sortValueKeys(parse(text)), indent);
}
