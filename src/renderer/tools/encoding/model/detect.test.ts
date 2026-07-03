import { describe, expect, it } from "vitest";

import { encodeLegacy } from "./cptable-codec";
import { detectCharset } from "./detect";

describe("编码探测", () => {
  it("识别 GBK 字节", () => {
    const bytes = encodeLegacy(
      "这是一段中文测试文本用于编码探测这是一段中文测试文本用于编码探测",
      936,
      false,
    ).bytes;
    const r = detectCharset(bytes);
    expect(["gbk", "gb2312", "gb18030"]).toContain(r?.charset);
  });

  it("识别 UTF-8 字节", () => {
    const bytes = new TextEncoder().encode(
      "これは日本語のテストです。エンコード判定。これは日本語のテストです。エンコード判定。",
    );
    const r = detectCharset(bytes);
    expect(r?.charset).toBe("utf-8");
  });

  it("空输入返回 undefined", () => {
    expect(detectCharset(new Uint8Array(0))).toBeUndefined();
  });
});
