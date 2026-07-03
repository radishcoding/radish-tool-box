import { isLosslessNumber, isSafeNumber, parse } from "lossless-json";
import diff from "microdiff";

import type { PathSegment } from "./json-node";
import { formatPath, type PathFormat } from "./json-path";

/**
 * 语义差异类型.
 */
export type DiffChangeType = "create" | "remove" | "change";

/**
 * 一条结构化语义差异.
 */
export interface DiffChange {
  readonly type: DiffChangeType;
  readonly path: readonly PathSegment[];
  readonly pathText: string;
  readonly oldValue: string | undefined;
  readonly newValue: string | undefined;
}

/**
 * 对两份 JSON 文本做结构化语义对比 (键序无关, 大数精度安全).
 */
export function semanticDiff(
  textA: string,
  textB: string,
  pathFormat: PathFormat = "js",
): DiffChange[] {
  const a = normalize(parse(textA)) as Record<string, unknown>;
  const b = normalize(parse(textB)) as Record<string, unknown>;
  return diff(a, b).map((change) => ({
    type: change.type.toLowerCase() as DiffChangeType,
    path: change.path as PathSegment[],
    pathText: formatPath(change.path as PathSegment[], pathFormat),
    oldValue: "oldValue" in change ? display(change.oldValue) : undefined,
    newValue: "value" in change ? display(change.value) : undefined,
  }));
}

/**
 * 归一化: LosslessNumber 安全则转 number (规整 2.370 -> 2.37), 否则保留精确字符串; 递归处理容器.
 */
function normalize(value: unknown): unknown {
  if (isLosslessNumber(value)) {
    const text = value.toString();
    return isSafeNumber(text) ? Number(text) : text;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = normalize(child);
    }
    return out;
  }
  return value;
}

/**
 * 把差异值显示为字符串.
 */
function display(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
