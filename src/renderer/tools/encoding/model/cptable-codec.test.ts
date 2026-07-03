import { describe, expect, it } from "vitest";

import { bytesToHex } from "@/lib/bytes-codec";

import { CHARSETS } from "./charsets";
import { decodeLegacy, encodeLegacy } from "./cptable-codec";

describe("旧字符集编解码", () => {
  it("GBK 中文 = D6D0CEC4", () => {
    expect(bytesToHex(encodeLegacy("中文", 936, false).bytes)).toBe("d6d0cec4");
    expect(
      decodeLegacy(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]), 936).text,
    ).toBe("中文");
  });

  it("与原生 TextDecoder 解码一致 (GBK)", () => {
    const bytes = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
    const native = new TextDecoder("gbk").decode(bytes);
    expect(decodeLegacy(bytes, 936).text).toBe(native);
  });

  it("Big5 / Shift_JIS / EUC-KR 往返", () => {
    for (const [text, cp] of [
      ["測試", 950],
      ["テスト", 932],
      ["한글", 949],
    ] as const) {
      const enc = encodeLegacy(text, cp, false);
      expect(decodeLegacy(enc.bytes, cp).text).toBe(text);
    }
  });

  it("ISO-8859-1 / Windows-1252 单字节", () => {
    expect(Array.from(encodeLegacy("é", 28591, false).bytes)).toEqual([0xe9]);
  });

  it("不可映射: 非严格替换为 ? 并出诊断", () => {
    const result = encodeLegacy("A😀B", 936, false);
    expect(result.error).toBeUndefined();
    expect(result.diagnostics.some((d) => d.level === "warn")).toBe(true);
    expect(result.bytes).toContain(0x3f); // '?'
  });

  it("不可映射: 严格模式报错", () => {
    const result = encodeLegacy("A😀B", 936, true);
    expect(result.error).toBeTruthy();
  });

  it("注册表中每个 codepage 项都可用 (ASCII 往返)", () => {
    for (const c of CHARSETS) {
      if (c.kind !== "codepage") continue;
      const enc = encodeLegacy("Az09", c.codepage!, false);
      expect(decodeLegacy(enc.bytes, c.codepage!).text, `${c.id}`).toBe("Az09");
    }
  });
});

// 回归: 替换符 (U+FFFD) 检测逻辑
describe("decodeLegacy -- U+FFFD 替换符检测回归", () => {
  it("可正常解码的字节不产生诊断 (防 includes 恒真回归)", () => {
    // GBK codepage 936, "中" 的字节 0xD6 0xD0
    const { diagnostics } = decodeLegacy(Uint8Array.from([0xd6, 0xd0]), 936);
    expect(diagnostics).toHaveLength(0);
  });

  it("含无法解码字节时产生 warn 诊断", () => {
    // CP1252 (codepage 1252) 解码 0x81 -- cptable 对此字节产出 U+FFFD
    const { diagnostics } = decodeLegacy(Uint8Array.from([0x81]), 1252);
    expect(diagnostics.some((d) => d.level === "warn")).toBe(true);
  });
});
