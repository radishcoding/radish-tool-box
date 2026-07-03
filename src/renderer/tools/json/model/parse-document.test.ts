import { describe, expect, it } from "vitest";

import { parseDocument } from "./parse-document";

describe("parseDocument", () => {
  it("严格解析有效 JSON", () => {
    const result = parseDocument('{"n":1}');
    expect(result.error).toBeUndefined();
    expect(result.repaired).toBe(false);
    expect(result.root?.type).toBe("object");
  });

  it("空白文本无内容无错误", () => {
    const result = parseDocument("   ");
    expect(result.root).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("不规范输入经 jsonrepair 容错解析", () => {
    const result = parseDocument("{a:1,}");
    expect(result.repaired).toBe(true);
    expect(result.root?.children[0].key).toBe("a");
  });

  it("无法修复时返回带位置的错误", () => {
    const result = parseDocument("}");
    expect(result.root).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(typeof result.error?.offset).toBe("number");
  });
});
