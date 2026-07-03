import { base64ToBytes, bytesToBase64, parseHex } from "@/lib/bytes-codec";
import { renderHex } from "@/lib/charset/hex";
import { fail, ok, type Diagnostic } from "@/lib/outcome";

import {
  ascii85ToBytes,
  base32ToBytes,
  base58ToBytes,
  base62ToBytes,
  bytesToAscii85,
  bytesToBase32,
  bytesToBase58,
  bytesToBase62,
} from "../bytes";
import { bytesToText, textToBytes } from "../charset-bridge";
import type { CodecChoiceOption, CodecContext, CodecDef } from "../types";

/**
 * 标准 Base64 字母表 (与 btoa 输出顺序一致), 供自定义码表位置重映射.
 */
const BASE64_STANDARD =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * 构造一个 "码表" 文本选项 (留空用默认表).
 * @param size 该进制要求的码表符号数.
 * @returns 码表选项声明.
 */
function alphabetOption(size: number): CodecChoiceOption {
  return {
    id: "alphabet",
    label: "码表",
    kind: "text",
    placeholder: `留空用默认 (${size} 字符)`,
    defaultValue: "",
  };
}

/**
 * 解析并校验用户输入的自定义码表.
 * @param custom 用户输入 (空串表示用默认表).
 * @param size 期望的码表长度.
 * @returns 校验通过的码表; 空输入返回 undefined (表示用默认表).
 * @throws Error 长度不符, 含重复字符或含空白时.
 */
function resolveAlphabet(custom: string, size: number): string | undefined {
  if (custom === "") {
    return undefined;
  }
  const chars = [...custom];
  if (/\s/.test(custom)) {
    throw new Error("码表不能含空白字符");
  }
  if (chars.length !== size) {
    throw new Error(`码表长度应为 ${size}, 当前为 ${chars.length}`);
  }
  if (new Set(chars).size !== size) {
    throw new Error("码表含重复字符");
  }
  return custom;
}

/**
 * 把异常归一为可读消息.
 * @param error 捕获的异常.
 * @returns 错误文案.
 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 按位置把字符串从 fromAlphabet 码表重映射到 toAlphabet 码表 (填充符 = 原样保留).
 * @param text 待映射文本.
 * @param fromAlphabet 源码表.
 * @param toAlphabet 目标码表.
 * @returns 映射后的文本 (未在源码表中的字符原样保留).
 */
function remapAlphabet(
  text: string,
  fromAlphabet: string,
  toAlphabet: string,
): string {
  const map = new Map<string, string>();
  for (let i = 0; i < fromAlphabet.length; i += 1) {
    map.set(fromAlphabet[i], toAlphabet[i]);
  }
  let out = "";
  for (const ch of text) {
    out += ch === "=" ? "=" : (map.get(ch) ?? ch);
  }
  return out;
}

/**
 * 用自定义 16 字符码表把字节渲染为紧凑十六进制 (每字节两位, 无分隔).
 * 自定义码表时显示形态固定为紧凑无分隔 (格式下拉/大小写不生效).
 * @param bytes 输入字节.
 * @param alphabet 16 字符码表.
 * @returns 渲染文本.
 */
function renderHexCustom(bytes: Uint8Array, alphabet: string): string {
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte >> 4] + alphabet[byte & 0x0f];
  }
  return out;
}

/**
 * 用自定义 16 字符码表把紧凑十六进制文本解析为字节 (忽略空白).
 * @param input 输入文本.
 * @param alphabet 16 字符码表.
 * @returns 解码字节.
 * @throws Error 长度为奇数或含非码表字符时.
 */
function parseHexCustom(input: string, alphabet: string): Uint8Array {
  const clean = input.replace(/\s+/g, "");
  if (clean.length % 2 !== 0) {
    throw new Error("十六进制长度应为偶数");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const high = alphabet.indexOf(clean[i * 2]);
    const low = alphabet.indexOf(clean[i * 2 + 1]);
    if (high === -1 || low === -1) {
      throw new Error("含非码表十六进制字符");
    }
    bytes[i] = (high << 4) | low;
  }
  return bytes;
}

/**
 * 构造一个二进制类 codec: 文本 <-(字符集)-> 字节 <-(算法)-> 文本.
 * @param id 标识.
 * @param label 名称.
 * @param toText 字节 -> 文本.
 * @param fromText 文本 -> 字节.
 * @param options 专属选项.
 * @returns codec 定义.
 */
function binaryCodec(
  id: string,
  label: string,
  toText: (bytes: Uint8Array, ctx: CodecContext) => string,
  fromText: (input: string, ctx: CodecContext) => Uint8Array,
  options?: CodecDef["options"],
): CodecDef {
  return {
    id,
    label,
    group: "binary",
    needsCharset: true,
    options,
    encode: (input, ctx) => {
      const diagnostics: Diagnostic[] = [];
      const { bytes, error } = textToBytes(input, ctx.charset, diagnostics);
      if (error !== undefined) {
        return fail(error, diagnostics);
      }
      try {
        return ok(toText(bytes, ctx), diagnostics);
      } catch (err) {
        return fail(message(err), diagnostics);
      }
    },
    decode: (input, ctx) => {
      const diagnostics: Diagnostic[] = [];
      let bytes: Uint8Array;
      try {
        bytes = fromText(input, ctx);
      } catch (err) {
        return fail(message(err), diagnostics);
      }
      return ok(bytesToText(bytes, ctx.charset, diagnostics), diagnostics);
    },
  };
}

/**
 * 把标准 base64 转为指定变体显示.
 * @param std 标准 base64.
 * @param variant 变体.
 * @returns 变体文本.
 */
function toBase64Variant(std: string, variant: string): string {
  if (variant !== "url") {
    return std;
  }
  return std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * 把任意 base64 变体还原为标准 base64.
 * @param input 变体文本.
 * @returns 标准 base64.
 */
function fromBase64Variant(input: string): string {
  const replaced = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    replaced.length % 4 === 0 ? "" : "=".repeat(4 - (replaced.length % 4));
  return replaced + pad;
}

/**
 * 全部二进制类 codec.
 */
export const BINARY_CODECS: readonly CodecDef[] = [
  binaryCodec(
    "base64",
    "Base64",
    (bytes, ctx) => {
      const alphabet = resolveAlphabet(ctx.options.alphabet ?? "", 64);
      const std = bytesToBase64(bytes);
      // 自定义码表时按位置重映射, 忽略 variant; 否则走标准/URL-safe 变体.
      return alphabet === undefined
        ? toBase64Variant(std, ctx.options.variant ?? "standard")
        : remapAlphabet(std, BASE64_STANDARD, alphabet);
    },
    (input, ctx) => {
      const alphabet = resolveAlphabet(ctx.options.alphabet ?? "", 64);
      if (alphabet === undefined) {
        return base64ToBytes(fromBase64Variant(input));
      }
      const std = remapAlphabet(input.trim(), alphabet, BASE64_STANDARD);
      return base64ToBytes(fromBase64Variant(std));
    },
    [
      {
        id: "variant",
        label: "变体",
        choices: [
          { value: "standard", label: "标准" },
          { value: "url", label: "URL-safe" },
        ],
        defaultValue: "standard",
      },
      alphabetOption(64),
    ],
  ),
  binaryCodec(
    "base32",
    "Base32",
    (bytes, ctx) =>
      bytesToBase32(bytes, resolveAlphabet(ctx.options.alphabet ?? "", 32)),
    (input, ctx) =>
      base32ToBytes(input, resolveAlphabet(ctx.options.alphabet ?? "", 32)),
    [alphabetOption(32)],
  ),
  binaryCodec(
    "base58",
    "Base58",
    (bytes, ctx) =>
      bytesToBase58(bytes, resolveAlphabet(ctx.options.alphabet ?? "", 58)),
    (input, ctx) =>
      base58ToBytes(input, resolveAlphabet(ctx.options.alphabet ?? "", 58)),
    [alphabetOption(58)],
  ),
  binaryCodec(
    "base62",
    "Base62",
    (bytes, ctx) =>
      bytesToBase62(bytes, resolveAlphabet(ctx.options.alphabet ?? "", 62)),
    (input, ctx) =>
      base62ToBytes(input, resolveAlphabet(ctx.options.alphabet ?? "", 62)),
    [alphabetOption(62)],
  ),
  binaryCodec(
    "base85",
    "Base85/Ascii85",
    (bytes, ctx) =>
      bytesToAscii85(bytes, resolveAlphabet(ctx.options.alphabet ?? "", 85)),
    (input, ctx) =>
      ascii85ToBytes(input, resolveAlphabet(ctx.options.alphabet ?? "", 85)),
    [alphabetOption(85)],
  ),
  binaryCodec(
    "hex",
    "Hex",
    (bytes, ctx) => {
      const alphabet = resolveAlphabet(ctx.options.alphabet ?? "", 16);
      return alphabet === undefined
        ? renderHex(bytes, ctx.hex)
        : renderHexCustom(bytes, alphabet);
    },
    (input, ctx) => {
      const alphabet = resolveAlphabet(ctx.options.alphabet ?? "", 16);
      return alphabet === undefined
        ? parseHex(input)
        : parseHexCustom(input, alphabet);
    },
    [alphabetOption(16)],
  ),
];
