import * as jschardet from "jschardet";

import { findCharset } from "./charsets";

/**
 * 探测结果: 命中的字符集 id 与置信度 (0~1).
 */
export interface DetectResult {
  readonly charset: string;
  readonly confidence: number;
}

/**
 * jschardet 编码名 (大写) 到本工具字符集 id 的映射.
 * 未在此表中的编码名将尝试经 findCharset 兜底查找.
 */
const NAME_TO_ID: Readonly<Record<string, string>> = {
  "UTF-8": "utf-8",
  "UTF-16LE": "utf-16le",
  "UTF-16BE": "utf-16be",
  ASCII: "ascii",
  GB2312: "gbk",
  GBK: "gbk",
  GB18030: "gb18030",
  BIG5: "big5",
  SHIFT_JIS: "shift_jis",
  "EUC-JP": "euc-jp",
  "EUC-KR": "euc-kr",
  "KOI8-R": "koi8-r",
  "WINDOWS-1250": "windows-1250",
  "WINDOWS-1251": "windows-1251",
  "WINDOWS-1252": "windows-1252",
  "WINDOWS-1253": "windows-1253",
  "WINDOWS-1255": "windows-1255",
  "ISO-8859-1": "iso-8859-1",
  "ISO-8859-2": "iso-8859-2",
  "ISO-8859-5": "iso-8859-5",
  "ISO-8859-7": "iso-8859-7",
  "ISO-8859-9": "iso-8859-9",
};

/**
 * 探测字节最可能的字符集.
 * 将 Uint8Array 转为 Latin1 二进制字符串后送入 jschardet, 再映射为本工具的字符集 id.
 * @param bytes 输入字节.
 * @returns 命中字符集与置信度; 空输入或无法识别时为 undefined.
 */
export function detectCharset(bytes: Uint8Array): DetectResult | undefined {
  if (bytes.length === 0) {
    return undefined;
  }

  // jschardet 接受 Latin1 二进制字符串 (每字符对应一字节).
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const detected = jschardet.detect(binary);
  if (!detected.encoding) {
    return undefined;
  }

  const upper = detected.encoding.toUpperCase();
  const mapped = NAME_TO_ID[upper];
  if (mapped !== undefined) {
    return { charset: mapped, confidence: detected.confidence };
  }

  // 兜底: 尝试在已知字符集表中按 id 匹配.
  const lower = upper.toLowerCase();
  const found = findCharset(lower);
  if (found === undefined) {
    return undefined;
  }
  return { charset: lower, confidence: detected.confidence };
}
