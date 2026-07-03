import { describe, expect, it } from "vitest";

import { bytesToHex } from "@/lib/bytes-codec";

import {
  decodeUnicode,
  encodeUnicode,
  formatUnicodeEscapes,
  parseUnicodeEscapes,
} from "./unicode-codec";

describe("Unicode 家族编解码", () => {
  it("UTF-8 中文", () => {
    expect(bytesToHex(encodeUnicode("中", "utf-8", false))).toBe("e4b8ad");
  });

  it("UTF-16LE / BE 字节序", () => {
    expect(bytesToHex(encodeUnicode("A", "utf-16le", false))).toBe("4100");
    expect(bytesToHex(encodeUnicode("A", "utf-16be", false))).toBe("0041");
  });

  it("UTF-16 BOM", () => {
    expect(bytesToHex(encodeUnicode("A", "utf-16le", true))).toBe("fffe4100");
    expect(bytesToHex(encodeUnicode("A", "utf-16be", true))).toBe("feff0041");
  });

  it("UTF-32 emoji 代理对单码点", () => {
    expect(bytesToHex(encodeUnicode("😀", "utf-32le", false))).toBe("00f60100");
    expect(bytesToHex(encodeUnicode("😀", "utf-32be", false))).toBe("0001f600");
  });

  it("emoji 在 UTF-16 为代理对", () => {
    expect(bytesToHex(encodeUnicode("😀", "utf-16be", false))).toBe("d83dde00");
  });

  it("各变体往返", () => {
    const text = "Aa中😀文Z";
    for (const v of [
      "utf-8",
      "utf-16le",
      "utf-16be",
      "utf-32le",
      "utf-32be",
    ] as const) {
      expect(decodeUnicode(encodeUnicode(text, v, false), v).text).toBe(text);
    }
  });

  it("decodeUnicode 跳过 BOM", () => {
    const withBom = encodeUnicode("中文", "utf-16le", true);
    expect(decodeUnicode(withBom, "utf-16le").text).toBe("中文");
  });

  it("parseUnicodeEscapes 接受 \\u 与 U+ 两式", () => {
    expect(parseUnicodeEscapes("\\u4e2d\\u6587")).toBe("中文");
    expect(parseUnicodeEscapes("U+4E2D U+6587")).toBe("中文");
    expect(parseUnicodeEscapes("\\u{1F600}")).toBe("😀");
  });

  it("formatUnicodeEscapes 两式", () => {
    expect(formatUnicodeEscapes("中文", "\\u")).toBe("\\u4e2d\\u6587");
    expect(formatUnicodeEscapes("中", "U+")).toBe("U+4E2D");
    expect(formatUnicodeEscapes("😀", "\\u")).toBe("\\u{1f600}");
  });

  it("parseUnicodeEscapes 混排顺序正确", () => {
    // 字面段 "A" 在转义码点之前, 混排结果应保留顺序
    expect(parseUnicodeEscapes("A\\u4e2d")).toBe("A中");
    expect(parseUnicodeEscapes("\\u4e2dB")).toBe("中B");
  });
});
