import { describe, expect, it } from "vitest";

import type { HexOptions } from "./types";
import { convert } from "./convert";

const HEX: HexOptions = { upperCase: false, format: "none" };

describe("透视转换", () => {
  it("文本 → GBK Hex", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "中文" },
      targetForm: "hex",
      targetCharset: "gbk",
      hex: HEX,
      strict: false,
    });
    expect(r.error).toBe("");
    expect(r.output).toBe("d6d0cec4");
  });

  it("GBK Hex → UTF-8 Hex", () => {
    const r = convert({
      source: { form: "hex", charset: "gbk", text: "d6d0cec4" },
      targetForm: "hex",
      targetCharset: "utf-8",
      hex: HEX,
      strict: false,
    });
    expect(r.output).toBe("e4b8ade69687");
  });

  it("GBK Hex → Unicode 码点", () => {
    const r = convert({
      source: { form: "hex", charset: "gbk", text: "d6d0cec4" },
      targetForm: "unicode",
      targetCharset: "utf-8",
      hex: HEX,
      strict: false,
    });
    expect(r.output).toBe("\\u4e2d\\u6587");
  });

  it("Unicode 码点 → GBK Hex", () => {
    const r = convert({
      source: { form: "unicode", charset: "utf-8", text: "\\u4e2d\\u6587" },
      targetForm: "hex",
      targetCharset: "gbk",
      hex: HEX,
      strict: false,
    });
    expect(r.output).toBe("d6d0cec4");
  });

  it("严格模式不可映射报错", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "😀" },
      targetForm: "hex",
      targetCharset: "gbk",
      hex: HEX,
      strict: true,
    });
    expect(r.error).not.toBe("");
  });

  it("源 Hex 非法字符报错", () => {
    const r = convert({
      source: { form: "hex", charset: "gbk", text: "zz" },
      targetForm: "text",
      targetCharset: "utf-8",
      hex: HEX,
      strict: false,
    });
    expect(r.error).not.toBe("");
  });

  it("Hex 大小写与空格格式", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "中" },
      targetForm: "hex",
      targetCharset: "utf-8",
      hex: { upperCase: true, format: "space" },
      strict: false,
    });
    expect(r.output).toBe("E4 B8 AD");
  });

  it("Hex 0x 数组格式", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "中" },
      targetForm: "hex",
      targetCharset: "utf-8",
      hex: { upperCase: true, format: "array-hex" },
      strict: false,
    });
    expect(r.output).toBe("{ 0xE4, 0xB8, 0xAD }");
  });

  it("Hex 十进制数组格式", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "中" },
      targetForm: "hex",
      targetCharset: "utf-8",
      hex: { upperCase: false, format: "array-dec" },
      strict: false,
    });
    expect(r.output).toBe("{ 228, 184, 173 }");
  });

  it("文本 -> 文本: 源 UTF-8 编码, 目标 GBK 解码 (乱码视图)", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "测试" },
      targetForm: "text",
      targetCharset: "gbk",
      hex: HEX,
      strict: false,
    });
    expect(r.error).toBe("");
    expect(r.output).toBe("娴嬭瘯");
  });

  it("文本 -> 文本: 同字符集恒等", () => {
    const r = convert({
      source: { form: "text", charset: "utf-8", text: "测试" },
      targetForm: "text",
      targetCharset: "utf-8",
      hex: HEX,
      strict: false,
    });
    expect(r.output).toBe("测试");
  });

  it("字节源 -> 文本目标: 目标字符集不参与 (直接呈现已解码 Unicode)", () => {
    const r = convert({
      source: { form: "hex", charset: "gbk", text: "d6d0cec4" },
      targetForm: "text",
      targetCharset: "big5",
      hex: HEX,
      strict: false,
    });
    expect(r.output).toBe("中文");
  });
});
