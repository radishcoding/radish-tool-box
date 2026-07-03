import { findCharset } from "@/lib/charset/charsets";
import { decodeLegacy, encodeLegacy } from "@/lib/charset/cptable-codec";
import { decodeUnicode, encodeUnicode } from "@/lib/charset/unicode-codec";
import type { Diagnostic } from "@/lib/outcome";

/**
 * 把文本按字符集转字节; 诊断累加进入参 diagnostics.
 * @param text 输入文本.
 * @param charsetId 字符集 id.
 * @param diagnostics 诊断累加器.
 * @returns 字节, 以及不可恢复时的错误说明.
 */
export function textToBytes(
  text: string,
  charsetId: string,
  diagnostics: Diagnostic[],
): { bytes: Uint8Array; error?: string } {
  const charset = findCharset(charsetId);
  if (charset === undefined) {
    return { bytes: new Uint8Array(0), error: "未知字符集" };
  }
  if (charset.kind === "unicode" && charset.unicode !== undefined) {
    return { bytes: encodeUnicode(text, charset.unicode, false) };
  }
  if (charset.codepage !== undefined) {
    const result = encodeLegacy(text, charset.codepage, false);
    diagnostics.push(...result.diagnostics);
    return { bytes: result.bytes, error: result.error };
  }
  return { bytes: new Uint8Array(0), error: "字符集定义不完整" };
}

/**
 * 把字节按字符集转文本; 诊断累加进入参 diagnostics.
 * @param bytes 输入字节.
 * @param charsetId 字符集 id.
 * @param diagnostics 诊断累加器.
 * @returns 解码文本.
 */
export function bytesToText(
  bytes: Uint8Array,
  charsetId: string,
  diagnostics: Diagnostic[],
): string {
  const charset = findCharset(charsetId);
  if (charset === undefined) {
    return "";
  }
  if (charset.kind === "unicode" && charset.unicode !== undefined) {
    const result = decodeUnicode(bytes, charset.unicode);
    diagnostics.push(...result.diagnostics);
    return result.text;
  }
  if (charset.codepage !== undefined) {
    const result = decodeLegacy(bytes, charset.codepage);
    diagnostics.push(...result.diagnostics);
    return result.text;
  }
  return "";
}
