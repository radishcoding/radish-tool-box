import * as cptable from "codepage";

import type { Diagnostic } from "@/lib/outcome";

/**
 * cptable.utils 的最小类型 (该包未提供完整 TS 类型).
 */
interface CptableUtils {
  readonly encode: (codepage: number, data: string) => number[];
  readonly decode: (codepage: number, data: ArrayLike<number>) => string;
}
const utils = (cptable as unknown as { utils: CptableUtils }).utils;

/**
 * 判断单个字符在指定 codepage 下是否可表示.
 * 通过编解码往返检验: 编码后再解码, 若结果不等于原字符则视为不可映射.
 * @param ch 单个字符 (for...of 迭代的完整 Unicode 码点).
 * @param codepage codepage 号.
 */
function isMappable(ch: string, codepage: number): boolean {
  try {
    const encoded = utils.encode(codepage, ch);
    const decoded = utils.decode(codepage, encoded);
    return decoded === ch;
  } catch {
    return false;
  }
}

/**
 * 把文本编码为旧字符集字节.
 * @param text 输入文本.
 * @param codepage codepage 号.
 * @param strict 严格模式: 遇不可映射字符直接报错而非替换.
 * @returns 字节数组, 诊断列表, 以及严格模式下的错误说明.
 */
export function encodeLegacy(
  text: string,
  codepage: number,
  strict: boolean,
): { bytes: Uint8Array; diagnostics: Diagnostic[]; error?: string } {
  const diagnostics: Diagnostic[] = [];
  const unmapped: string[] = [];
  for (const ch of text) {
    if (!isMappable(ch, codepage)) {
      unmapped.push(ch);
    }
  }
  if (unmapped.length > 0) {
    if (strict) {
      return {
        bytes: new Uint8Array(0),
        diagnostics: [],
        error: `字符 ${unmapped.slice(0, 5).join(" ")} 在该字符集中无对应 (严格模式)`,
      };
    }
    diagnostics.push({
      level: "warn",
      message: `${unmapped.length} 个字符无对应, 已替换为 ?: ${unmapped.slice(0, 5).join(" ")}`,
    });
  }
  // 非严格模式下将不可映射字符替换为 '?' 后再编码, 以确保输出中含 0x3f.
  const unmappedSet = new Set(unmapped);
  const safeText =
    unmappedSet.size > 0
      ? [...text].map((ch) => (unmappedSet.has(ch) ? "?" : ch)).join("")
      : text;
  try {
    return {
      bytes: Uint8Array.from(utils.encode(codepage, safeText)),
      diagnostics,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      bytes: new Uint8Array(0),
      diagnostics: [],
      error: `编码失败: ${message}`,
    };
  }
}

/**
 * 把旧字符集字节解码为文本; 非法字节由 cptable 产出替换符.
 * @param bytes 输入字节.
 * @param codepage codepage 号.
 * @returns 解码文本与诊断列表.
 */
export function decodeLegacy(
  bytes: Uint8Array,
  codepage: number,
): { text: string; diagnostics: Diagnostic[] } {
  let text: string;
  try {
    text = utils.decode(codepage, Array.from(bytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: "",
      diagnostics: [{ level: "error", message: `解码失败: ${message}` }],
    };
  }
  const diagnostics: Diagnostic[] = [];
  // cptable 对无法解码的字节产出 U+FFFD (Unicode 替换符), 用转义避免字形在源码中丢失.
  if (text.includes("�")) {
    diagnostics.push({
      level: "warn",
      message: "存在无法解码的字节, 已用 � 替换",
    });
  }
  return { text, diagnostics };
}
