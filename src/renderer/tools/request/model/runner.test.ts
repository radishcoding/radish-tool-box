import { describe, expect, it } from "vitest";

import { createDefaultRequest } from "./types";
import type { CollectionNode } from "./collection-tree";
import {
  flattenRequests,
  parseDataRows,
  runCollection,
  type RequestExecutor,
} from "./runner";

const reqNode = (id: string, name: string): CollectionNode => ({
  id,
  type: "request",
  name,
  request: createDefaultRequest(),
});

describe("parseDataRows", () => {
  it("CSV 表头 + 行", () => {
    const rows = parseDataRows("name,age\nalice,30\nbob,25", "csv");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "alice", age: "30" });
  });

  it("JSON 数组对象, 值字符串化", () => {
    const rows = parseDataRows(
      '[{"name":"a","n":1},{"name":"b","n":2}]',
      "json",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ name: "b", n: "2" });
  });

  it("空文本返回空数组", () => {
    expect(parseDataRows("", "csv")).toHaveLength(0);
    expect(parseDataRows("   ", "json")).toHaveLength(0);
  });

  // 新增: 畸形 CSV 抛错 (引号未闭合).
  it("畸形 CSV (引号未闭合) 抛错, 不静默产脏行", () => {
    // PapaParse 将引号未闭合的 CSV 报为错误 -> 驱动应抛错.
    expect(() => parseDataRows('name,value\nalice,"unclosed', "csv")).toThrow(
      /CSV 解析失败/,
    );
  });

  // 单列 CSV (无分隔符) 会触发 UndetectableDelimiter 警告, 但数据正确, 不应抛错.
  it("单列 CSV (n\\na\\nb) 解析为 2 行不抛错", () => {
    const rows = parseDataRows("n\na\nb", "csv");
    expect(rows).toEqual([{ n: "a" }, { n: "b" }]);
  });

  // 新增: JSON 非数组抛错.
  it("JSON 数据源非数组抛错", () => {
    expect(() => parseDataRows('{"name":"a"}', "json")).toThrow(
      /JSON 数据源必须是对象数组/,
    );
  });

  // 新增: toStringValue 对各特殊值的字符串化行为.
  it("JSON 中 null -> 空串, 嵌套对象 -> JSON, 布尔 -> 'true'/'false'", () => {
    const rows = parseDataRows(
      '[{"a":null,"b":{"x":1},"c":true,"d":false}]',
      "json",
    );
    expect(rows).toHaveLength(1);
    // null -> "".
    expect(rows[0].a).toBe("");
    // 嵌套对象 -> JSON 字符串.
    expect(rows[0].b).toBe('{"x":1}');
    // 布尔.
    expect(rows[0].c).toBe("true");
    expect(rows[0].d).toBe("false");
  });
});

describe("flattenRequests", () => {
  it("深度优先展平含文件夹", () => {
    const nodes: CollectionNode[] = [
      reqNode("r1", "A"),
      { id: "f1", type: "folder", name: "F", children: [reqNode("r2", "B")] },
      reqNode("r3", "C"),
    ];
    const flat = flattenRequests(nodes);
    expect(flat.map((n) => n.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("runCollection", () => {
  it("无数据源跑 1 次, 聚合断言", async () => {
    const requests = [reqNode("r1", "A"), reqNode("r2", "B")] as const;
    const execute: RequestExecutor = () =>
      Promise.resolve({
        statusCode: 200,
        timeMs: 10,
        tests: [{ name: "t", passed: true, error: "" }],
        error: "",
        mutations: [],
      });
    const summary = await runCollection(
      requests.filter((n) => n.type === "request"),
      [],
      execute,
    );
    expect(summary.iterations).toBe(1);
    expect(summary.totalRequests).toBe(2);
    expect(summary.totalAssertions).toBe(2);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.results).toHaveLength(2);
  });

  it("数据源 2 行跑 2 迭代, 行数据传入执行器", async () => {
    const requests = [reqNode("r1", "A")].filter((n) => n.type === "request");
    const seenRows: Record<string, string>[] = [];
    const execute: RequestExecutor = (_, row) => {
      seenRows.push({ ...row });
      return Promise.resolve({
        statusCode: 200,
        timeMs: 5,
        tests: [{ name: "t", passed: row.ok === "yes", error: "" }],
        error: "",
        mutations: [],
      });
    };
    const summary = await runCollection(
      requests,
      [{ ok: "yes" }, { ok: "no" }],
      execute,
    );
    expect(summary.iterations).toBe(2);
    expect(summary.totalRequests).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(seenRows).toEqual([{ ok: "yes" }, { ok: "no" }]);
  });
});
