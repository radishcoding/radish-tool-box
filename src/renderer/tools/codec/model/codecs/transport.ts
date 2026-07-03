import { toASCII, toUnicode } from "punycode/";

import { fail, ok } from "@/lib/outcome";

import type { CodecDef } from "../types";

/**
 * 把文本按 UTF-8 做 Quoted-Printable 编码 (软换行从简, 仅转义必要字节).
 * @param input 原文.
 * @returns QP 文本.
 */
function quotedPrintableEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let out = "";
  for (const byte of bytes) {
    const printable =
      (byte >= 33 && byte <= 126 && byte !== 61) || byte === 32 || byte === 9;
    if (printable) {
      out += String.fromCharCode(byte);
    } else {
      out += "=" + byte.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

/**
 * 还原 Quoted-Printable 文本为 UTF-8 字符串.
 * @param input QP 文本.
 * @returns 原文.
 * @throws Error 含非法转义时.
 */
function quotedPrintableDecode(input: string): string {
  const cleaned = input.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === "=") {
      const hex = cleaned.slice(i + 1, i + 3);
      // Number.parseInt("3X", 16) 返回 3 而非 NaN, 必须先用正则严格校验.
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
        throw new Error("非法 Quoted-Printable 转义");
      }
      out.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      out.push(ch.charCodeAt(0));
    }
  }
  return new TextDecoder().decode(Uint8Array.from(out));
}

/**
 * 传输类 codec: Quoted-Printable 与 Punycode.
 */
export const TRANSPORT_CODECS: readonly CodecDef[] = [
  {
    id: "quoted-printable",
    label: "Quoted-Printable",
    group: "transport",
    needsCharset: false,
    encode: (input) => ok(quotedPrintableEncode(input)),
    decode: (input) => {
      try {
        return ok(quotedPrintableDecode(input));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    id: "punycode",
    label: "Punycode (IDN)",
    group: "transport",
    needsCharset: false,
    encode: (input) => {
      try {
        return ok(toASCII(input));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
    decode: (input) => {
      try {
        return ok(toUnicode(input));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
