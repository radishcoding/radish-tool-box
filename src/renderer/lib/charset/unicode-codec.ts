import type { Diagnostic } from "@/lib/outcome";

import type { UnicodeVariant } from "./charsets";

/**
 * UTF-8 单例编解码器.
 */
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8");

/**
 * 把文本编码为指定 Unicode 变体字节; withBom 为 true 时前置 BOM.
 * @param text 输入文本.
 * @param variant Unicode 变体.
 * @param withBom 是否前置 BOM.
 * @returns 编码后的字节数组.
 */
export function encodeUnicode(
  text: string,
  variant: UnicodeVariant,
  withBom: boolean,
): Uint8Array {
  if (variant === "utf-8") {
    const body = UTF8_ENCODER.encode(text);
    if (!withBom) {
      return body;
    }
    const out = new Uint8Array(body.length + 3);
    out.set([0xef, 0xbb, 0xbf], 0);
    out.set(body, 3);
    return out;
  }

  const codePoints = Array.from(text).map((ch) => ch.codePointAt(0) ?? 0);

  if (variant === "utf-32le" || variant === "utf-32be") {
    const little = variant === "utf-32le";
    const out = new Uint8Array((codePoints.length + (withBom ? 1 : 0)) * 4);
    const view = new DataView(out.buffer);
    let offset = 0;
    if (withBom) {
      view.setUint32(0, 0xfeff, little);
      offset = 4;
    }
    for (const cp of codePoints) {
      view.setUint32(offset, cp, little);
      offset += 4;
    }
    return out;
  }

  // UTF-16: 超出 BMP 的码点拆为代理对
  const little = variant === "utf-16le";
  const units: number[] = [];
  for (const cp of codePoints) {
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      units.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else {
      units.push(cp);
    }
  }
  const out = new Uint8Array((units.length + (withBom ? 1 : 0)) * 2);
  const view = new DataView(out.buffer);
  let offset = 0;
  if (withBom) {
    view.setUint16(0, 0xfeff, little);
    offset = 2;
  }
  for (const unit of units) {
    view.setUint16(offset, unit, little);
    offset += 2;
  }
  return out;
}

/**
 * 把指定 Unicode 变体字节解码为文本; 自动跳过匹配的 BOM.
 * @param bytes 输入字节.
 * @param variant Unicode 变体.
 * @returns 解码文本与诊断信息.
 */
export function decodeUnicode(
  bytes: Uint8Array,
  variant: UnicodeVariant,
): { text: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (variant === "utf-8") {
    let body = bytes;
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      body = bytes.subarray(3);
    }
    return { text: UTF8_DECODER.decode(body), diagnostics };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (variant === "utf-32le" || variant === "utf-32be") {
    const little = variant === "utf-32le";
    let start = 0;
    if (bytes.length >= 4 && view.getUint32(0, little) === 0xfeff) {
      start = 4;
    }
    if ((bytes.length - start) % 4 !== 0) {
      diagnostics.push({
        level: "warn",
        message: "字节数不是 4 的倍数, 末尾不完整",
      });
    }
    let text = "";
    for (let offset = start; offset + 4 <= bytes.length; offset += 4) {
      const cp = view.getUint32(offset, little);
      text += cp <= 0x10ffff ? String.fromCodePoint(cp) : "?";
    }
    return { text, diagnostics };
  }

  // UTF-16
  const little = variant === "utf-16le";
  let start = 0;
  if (bytes.length >= 2 && view.getUint16(0, little) === 0xfeff) {
    start = 2;
  }
  if ((bytes.length - start) % 2 !== 0) {
    diagnostics.push({
      level: "warn",
      message: "字节数不是 2 的倍数, 末尾不完整",
    });
  }
  const units: number[] = [];
  for (let offset = start; offset + 2 <= bytes.length; offset += 2) {
    units.push(view.getUint16(offset, little));
  }
  return { text: String.fromCharCode(...units), diagnostics };
}

/**
 * 解析 Unicode 码点转义文本为真实字符串.
 * 支持 \uXXXX, \u{XXXXX}, U+XXXX 三式, 可与普通字面字符混排.
 * 按正则 match 顺序依次把字面段 (去除空白) 与转义段追加到结果,
 * 保证混排时顺序与原文一致.
 * @param input 转义文本.
 * @returns 还原后的真实字符串.
 */
export function parseUnicodeEscapes(input: string): string {
  const pattern =
    /\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|U\+([0-9a-fA-F]+)/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    // 先把本次 match 之前的字面段 (去除空白) 追加进结果
    result += input.slice(lastIndex, match.index).replace(/\s+/g, "");
    // 再把当前转义码点还原为字符追加
    const hex = match[1] ?? match[2] ?? match[3] ?? "";
    result += String.fromCodePoint(Number.parseInt(hex, 16));
    lastIndex = pattern.lastIndex;
  }
  // 追加末尾剩余字面段
  result += input.slice(lastIndex).replace(/\s+/g, "");
  return result;
}

/**
 * 把字符串格式化为 Unicode 码点转义.
 * BMP 内用 \uXXXX / U+XXXX; 星平面用 \u{XXXXX} / U+XXXXX.
 * U+ 风格多码点之间用空格分隔; \u 风格直接拼接.
 * @param text 输入文本.
 * @param style 转义风格.
 * @returns 转义后的字符串.
 */
export function formatUnicodeEscapes(
  text: string,
  style: "\\u" | "U+",
): string {
  const parts: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (style === "U+") {
      parts.push("U+" + cp.toString(16).toUpperCase().padStart(4, "0"));
    } else if (cp > 0xffff) {
      parts.push("\\u{" + cp.toString(16) + "}");
    } else {
      parts.push("\\u" + cp.toString(16).padStart(4, "0"));
    }
  }
  return style === "U+" ? parts.join(" ") : parts.join("");
}
