import { base64ToBytes, bytesToBase64, parseHex } from "@/lib/bytes-codec";
import type { Diagnostic, ResultView } from "@/lib/outcome";

import { findCharset } from "./charsets";
import { decodeLegacy, encodeLegacy } from "./cptable-codec";
import { renderHex } from "./hex-format";
import {
  EncodingError,
  formNeedsCharset,
  type Form,
  type HexOptions,
  type SideState,
} from "./types";
import {
  decodeUnicode,
  encodeUnicode,
  formatUnicodeEscapes,
  parseUnicodeEscapes,
} from "./unicode-codec";

/**
 * convert 的入参.
 */
export interface ConvertInput {
  readonly source: SideState;
  readonly targetForm: Form;
  readonly targetCharset: string;
  readonly hex: HexOptions;
  readonly strict: boolean;
}

/**
 * 把某字符集的字节解码为 Unicode 字符串.
 * @param bytes 输入字节.
 * @param charsetId 字符集 id.
 * @param diagnostics 累积诊断列表.
 * @returns 解码后的 Unicode 字符串.
 */
function bytesToUnicode(
  bytes: Uint8Array,
  charsetId: string,
  diagnostics: Diagnostic[],
): string {
  const charset = findCharset(charsetId);
  if (!charset) {
    throw new EncodingError(`未知字符集: ${charsetId}`);
  }
  if (charset.kind === "unicode") {
    const r = decodeUnicode(bytes, charset.unicode!);
    diagnostics.push(...r.diagnostics);
    return r.text;
  }
  const r = decodeLegacy(bytes, charset.codepage!);
  diagnostics.push(...r.diagnostics);
  return r.text;
}

/**
 * 把 Unicode 字符串编码为某字符集字节.
 * @param text 输入文本.
 * @param charsetId 字符集 id.
 * @param strict 严格模式: 遇不可映射字符报错.
 * @param diagnostics 累积诊断列表.
 * @returns 编码后的字节数组.
 */
function unicodeToBytes(
  text: string,
  charsetId: string,
  strict: boolean,
  diagnostics: Diagnostic[],
): Uint8Array {
  const charset = findCharset(charsetId);
  if (!charset) {
    throw new EncodingError(`未知字符集: ${charsetId}`);
  }
  if (charset.kind === "unicode") {
    return encodeUnicode(text, charset.unicode!, false);
  }
  const r = encodeLegacy(text, charset.codepage!, strict);
  if (r.error !== undefined) {
    throw new EncodingError(r.error);
  }
  diagnostics.push(...r.diagnostics);
  return r.bytes;
}

/**
 * 把源侧状态解码为中转 Unicode 字符串.
 * @param source 源侧状态.
 * @param diagnostics 累积诊断列表.
 * @returns 中转 Unicode 字符串.
 */
function decodeSource(source: SideState, diagnostics: Diagnostic[]): string {
  switch (source.form) {
    case "text":
      return source.text;
    case "unicode":
      return parseUnicodeEscapes(source.text);
    case "hex":
      return bytesToUnicode(parseHex(source.text), source.charset, diagnostics);
    case "base64":
      return bytesToUnicode(
        base64ToBytes(source.text),
        source.charset,
        diagnostics,
      );
    default: {
      const exhaustive: never = source.form;
      throw new EncodingError(`未知形态: ${String(exhaustive)}`);
    }
  }
}

/**
 * 把中转 Unicode 字符串编码为目标侧文本.
 * @param unicode 中转 Unicode 字符串.
 * @param input 转换入参.
 * @param diagnostics 累积诊断列表.
 * @returns 目标侧文本.
 */
function encodeTarget(
  unicode: string,
  input: ConvertInput,
  diagnostics: Diagnostic[],
): string {
  switch (input.targetForm) {
    case "text":
      // 源为文本时, 用 源字符集编码 -> 目标字符集解码 做一次字节往返:
      // 字符集相同则恒等, 不同则呈现转码/乱码视图 (如 UTF-8 字节按 GBK 读出).
      // 源为字节/码点形态时, 已是解码后的 Unicode, 直接呈现.
      if (input.source.form === "text") {
        const bytes = unicodeToBytes(
          unicode,
          input.source.charset,
          input.strict,
          diagnostics,
        );
        return bytesToUnicode(bytes, input.targetCharset, diagnostics);
      }
      return unicode;
    case "unicode":
      return formatUnicodeEscapes(unicode, "\\u");
    case "hex":
      return renderHex(
        unicodeToBytes(unicode, input.targetCharset, input.strict, diagnostics),
        input.hex,
      );
    case "base64":
      return bytesToBase64(
        unicodeToBytes(unicode, input.targetCharset, input.strict, diagnostics),
      );
    default: {
      const exhaustive: never = input.targetForm;
      throw new EncodingError(`未知形态: ${String(exhaustive)}`);
    }
  }
}

/**
 * 执行一次完整的字符集转换: 源 → Unicode → 目标.
 * 任何步骤抛出 EncodingError 都归一为失败结果, 不向外抛.
 * @param input 转换入参.
 * @returns 结果视图, 包含输出文本, 错误文案与诊断列表.
 */
export function convert(input: ConvertInput): ResultView {
  const diagnostics: Diagnostic[] = [];
  try {
    const unicode = decodeSource(input.source, diagnostics);
    const output = encodeTarget(unicode, input, diagnostics);
    return { output, error: "", diagnostics };
  } catch (error) {
    return {
      output: "",
      error: error instanceof Error ? error.message : "转换失败",
      diagnostics,
    };
  }
}

/**
 * 供 UI 判断目标字符集下拉是否需要展示 (与源同语义).
 * @param form 目标形态.
 * @returns 目标形态是否需要字符集.
 */
export function targetNeedsCharset(form: Form): boolean {
  return formNeedsCharset(form);
}
