import he from "he";

import { fail, ok, type Diagnostic } from "@/lib/outcome";

import { bytesToText, textToBytes } from "../charset-bridge";
import type { CodecDef } from "../types";

/**
 * 把异常归一为可读消息.
 * @param error 捕获的异常.
 * @returns 错误文案.
 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 组件模式 (encodeURIComponent 语义) 不转义的 ASCII 字符集合.
 */
const COMPONENT_SAFE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()";

/**
 * 整 URL 模式 (encodeURI 语义) 额外保留的 ASCII 字符 (在组件集基础上叠加).
 */
const FULL_SAFE = COMPONENT_SAFE + "#$&+,/:;=?@";

/**
 * 按字节逐个百分号编码; 安全集内的 ASCII 字节原样保留, 其余转 %XX (大写).
 * @param bytes 输入字节.
 * @param safe 不转义的 ASCII 字符集合.
 * @returns 百分号编码文本.
 */
function percentEncodeBytes(bytes: Uint8Array, safe: string): string {
  let out = "";
  for (const byte of bytes) {
    const ch = String.fromCharCode(byte);
    if (byte <= 0x7f && safe.includes(ch)) {
      out += ch;
    } else {
      out += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

/**
 * 把百分号编码文本解析为字节: %XX -> 字节, 字面字符按字符集转字节.
 * @param text 百分号编码文本.
 * @param charset 字符集 id (字面字符的字节来源).
 * @param diagnostics 诊断累加器.
 * @returns 解析出的字节.
 * @throws Error 含非法 %XX 转义或字符集编码失败时.
 */
function percentDecodeToBytes(
  text: string,
  charset: string,
  diagnostics: Diagnostic[],
): Uint8Array {
  const out: number[] = [];
  let literal = "";
  const flush = (): void => {
    if (literal !== "") {
      const result = textToBytes(literal, charset, diagnostics);
      if (result.error !== undefined) {
        throw new Error(result.error);
      }
      out.push(...result.bytes);
      literal = "";
    }
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "%") {
      flush();
      const hex = text.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
        throw new Error("非法 URL 转义");
      }
      out.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      literal += ch;
    }
  }
  flush();
  return Uint8Array.from(out);
}

/**
 * Web 类 codec: URL 百分号编码 (字符集感知) 与 HTML 实体.
 */
export const WEB_CODECS: readonly CodecDef[] = [
  {
    id: "url",
    label: "Url 编码",
    group: "web",
    needsCharset: true,
    options: [
      {
        id: "mode",
        label: "范围",
        choices: [
          { value: "component", label: "组件" },
          { value: "full", label: "整 URL" },
        ],
        defaultValue: "component",
      },
    ],
    encode: (input, ctx) => {
      const diagnostics: Diagnostic[] = [];
      const { bytes, error } = textToBytes(input, ctx.charset, diagnostics);
      if (error !== undefined) {
        return fail(error, diagnostics);
      }
      const safe = ctx.options.mode === "full" ? FULL_SAFE : COMPONENT_SAFE;
      return ok(percentEncodeBytes(bytes, safe), diagnostics);
    },
    decode: (input, ctx) => {
      const diagnostics: Diagnostic[] = [];
      let bytes: Uint8Array;
      try {
        bytes = percentDecodeToBytes(input, ctx.charset, diagnostics);
      } catch (err) {
        return fail(message(err), diagnostics);
      }
      return ok(bytesToText(bytes, ctx.charset, diagnostics), diagnostics);
    },
  },
  {
    id: "html",
    label: "Html 编码",
    group: "web",
    needsCharset: false,
    options: [
      {
        id: "scope",
        label: "范围",
        choices: [
          { value: "special", label: "仅特殊字符" },
          { value: "all", label: "全部非 ASCII" },
        ],
        defaultValue: "special",
      },
    ],
    encode: (input, ctx) =>
      ok(
        he.encode(input, {
          useNamedReferences: true,
          encodeEverything: ctx.options.scope === "all",
        }),
      ),
    decode: (input) => ok(he.decode(input)),
  },
];
