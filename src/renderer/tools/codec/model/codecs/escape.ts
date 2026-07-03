import {
  formatUnicodeEscapes,
  parseUnicodeEscapes,
} from "@/lib/charset/unicode-codec";
import { ok } from "@/lib/outcome";

import type { CodecDef } from "../types";

/**
 * JS 字符串转义映射 (字符 -> 转义序列).
 */
const JS_ESCAPE_MAP: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  '"': '\\"',
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
  "\v": "\\v",
  "\0": "\\0",
};

/**
 * 把文本做 JS 字符串转义 (控制字符与引号/反斜杠).
 * @param input 原文.
 * @returns 转义文本.
 */
function jsEscape(input: string): string {
  let out = "";
  for (const ch of input) {
    const mapped = JS_ESCAPE_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20) {
      out += "\\x" + code.toString(16).padStart(2, "0");
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * 还原 JS 字符串转义.
 * @param input 转义文本.
 * @returns 还原文本.
 */
function jsUnescape(input: string): string {
  return input.replace(
    /\\(x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|[\s\S])/g,
    (_match, seq: string) => {
      if (seq[0] === "x") {
        return String.fromCharCode(Number.parseInt(seq.slice(1), 16));
      }
      if (seq[0] === "u") {
        const hex = seq[1] === "{" ? seq.slice(2, -1) : seq.slice(1);
        return String.fromCodePoint(Number.parseInt(hex, 16));
      }
      const simple: Readonly<Record<string, string>> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        v: "\v",
        "0": "\0",
        "\\": "\\",
        '"': '"',
        "'": "'",
      };
      return simple[seq] ?? seq;
    },
  );
}

/**
 * 转义类 codec: Unicode 码点转义与 JS 字符串转义.
 */
export const ESCAPE_CODECS: readonly CodecDef[] = [
  {
    id: "unicode-escape",
    label: "Unicode 转义",
    group: "escape",
    needsCharset: false,
    encode: (input) => ok(formatUnicodeEscapes(input, "\\u")),
    decode: (input) => ok(parseUnicodeEscapes(input)),
  },
  {
    id: "js-escape",
    label: "Js 转义",
    group: "escape",
    needsCharset: false,
    encode: (input) => ok(jsEscape(input)),
    decode: (input) => ok(jsUnescape(input)),
  },
];
