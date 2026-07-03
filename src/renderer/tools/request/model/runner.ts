import Papa from "papaparse";

import type {
  HttpRequest,
  ScriptMutation,
  TestResult,
} from "../../../../network/request-channels";
import type { CollectionNode, CollectionRequestNode } from "./collection-tree";

/**
 * 数据源格式.
 */
export type DataFormat = "csv" | "json";

/**
 * 单个请求单次迭代的执行结果.
 */
export interface RunResult {
  readonly requestId: string;
  readonly requestName: string;
  readonly iteration: number;
  readonly statusCode: number;
  readonly timeMs: number;
  readonly tests: readonly TestResult[];
  readonly error: string;
}

/**
 * 一次集合运行的汇总.
 */
export interface RunSummary {
  readonly iterations: number;
  readonly totalRequests: number;
  readonly totalAssertions: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly RunResult[];
}

/**
 * 执行器返回的单次执行原始结果.
 */
export interface RunExecution {
  readonly statusCode: number;
  readonly timeMs: number;
  readonly tests: readonly TestResult[];
  readonly error: string;
  // 本次执行中脚本 (pm.environment.set 等) 产生的变量改动, 供运行器链式传给后续请求.
  readonly mutations: readonly ScriptMutation[];
}

/**
 * 请求执行器: 给定请求与当前数据行, 执行一次并返回结果.
 */
export type RequestExecutor = (
  request: HttpRequest,
  dataRow: Readonly<Record<string, string>>,
) => Promise<RunExecution>;

/**
 * 把任意单元值字符串化 (用于统一数据行的值类型).
 * @param value 原始值.
 * @returns 字符串.
 */
function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * 解析数据源文本为变量行数组 (CSV 表头作键; JSON 数组对象; 值统一字符串化).
 * @param text 数据源文本.
 * @param format 数据格式.
 * @returns 变量行数组 (空文本返回空数组).
 */
export function parseDataRows(
  text: string,
  format: DataFormat,
): readonly Record<string, string>[] {
  if (text.trim() === "") {
    return [];
  }
  if (format === "json") {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON 数据源必须是对象数组");
    }
    return parsed.map((item) => {
      const row: Record<string, string> = {};
      if (item !== null && typeof item === "object") {
        for (const [key, value] of Object.entries(item)) {
          row[key] = toStringValue(value);
        }
      }
      return row;
    });
  }
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  // 畸形 CSV (引号未闭合等) 不静默产出错位脏行, 与 JSON 分支对称明确报错.
  // 但忽略 UndetectableDelimiter: 单列 CSV (无分隔符) 会必然触发它, 且数据仍正确解析.
  const fatal = result.errors.filter((e) => e.code !== "UndetectableDelimiter");
  if (fatal.length > 0) {
    throw new Error(`CSV 解析失败: ${fatal[0].message}`);
  }
  return result.data.map((item) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      row[key] = toStringValue(value);
    }
    return row;
  });
}

/**
 * 深度优先展平集合树为请求节点序列 (文件夹内请求按出现顺序展开).
 * @param nodes 集合树节点.
 * @returns 请求节点序列.
 */
export function flattenRequests(
  nodes: readonly CollectionNode[],
): readonly CollectionRequestNode[] {
  const out: CollectionRequestNode[] = [];
  for (const node of nodes) {
    if (node.type === "request") {
      out.push(node);
    } else {
      out.push(...flattenRequests(node.children));
    }
  }
  return out;
}

/**
 * 顺序运行集合的全部请求, 按数据行迭代, 聚合断言汇总.
 * @param requests 展平后的请求节点序列.
 * @param rows 数据行 (空则跑 1 次空行迭代).
 * @param execute 请求执行器.
 * @param onProgress 进度回调 (已完成请求数, 总请求数).
 * @returns 运行汇总.
 */
export async function runCollection(
  requests: readonly CollectionRequestNode[],
  rows: readonly Record<string, string>[],
  execute: RequestExecutor,
  onProgress?: (done: number, total: number) => void,
): Promise<RunSummary> {
  const iterations = rows.length === 0 ? 1 : rows.length;
  const total = iterations * requests.length;
  const results: RunResult[] = [];
  let passed = 0;
  let failed = 0;
  let totalAssertions = 0;
  let done = 0;

  for (let i = 0; i < iterations; i += 1) {
    const row = rows[i] ?? {};
    for (const node of requests) {
      const execution = await execute(node.request, row);
      for (const test of execution.tests) {
        totalAssertions += 1;
        if (test.passed) {
          passed += 1;
        } else {
          failed += 1;
        }
      }
      results.push({
        requestId: node.id,
        requestName: node.name,
        iteration: i,
        statusCode: execution.statusCode,
        timeMs: execution.timeMs,
        tests: execution.tests,
        error: execution.error,
      });
      done += 1;
      onProgress?.(done, total);
    }
  }

  return {
    iterations,
    totalRequests: total,
    totalAssertions,
    passed,
    failed,
    results,
  };
}
