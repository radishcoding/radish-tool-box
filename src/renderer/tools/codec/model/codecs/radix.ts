import { renderHex, type HexOptions } from "@/lib/charset/hex";
import { fail, ok } from "@/lib/outcome";

import type { CodecChoiceOption, CodecDef } from "../types";

/**
 * 进制选项 (2-36 常用项).
 */
const RADIX_CHOICES: CodecChoiceOption["choices"] = [
  { value: "2", label: "2 (二进制)" },
  { value: "8", label: "8 (八进制)" },
  { value: "10", label: "10 (十进制)" },
  { value: "16", label: "16 (十六进制)" },
  { value: "36", label: "36 (三十六进制)" },
];

/**
 * 去掉十六进制显示格式的修饰 (0x 前缀, 空白, 分隔符, 花括号),
 * 以便把带显示形态的 hex 文本作为 16 进制输入解析.
 * @param text 可能带格式的十六进制文本.
 * @returns 仅含十六进制数字的紧凑串.
 */
function stripHexFormat(text: string): string {
  return text.replace(/0x/gi, "").replace(/[\s:_,{}-]+/g, "");
}

/**
 * 把非负大整数转为大端最小字节序列 (供 renderHex 渲染显示形态).
 * @param value 非负大整数.
 * @returns 大端字节序列 (值为 0 时返回单字节 0).
 */
function bigIntToBytes(value: bigint): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * 用 BigInt 按 inBase -> outBase 进制转换 (支持任意 2-36, 含负号).
 * 当 inBase 为 16 时容忍带显示格式的 hex 输入 (0x/空格/分隔符/花括号);
 * 当 outBase 为 16 时按 hex 显示选项渲染输出 (无/空格/连字符/0x 数组/十进制数组 + 大小写).
 * @param input 数值串.
 * @param inBase 源进制.
 * @param outBase 目标进制.
 * @param hex 十六进制显示选项 (仅当 outBase 为 16 时生效).
 * @returns 目标进制串.
 * @throws Error 进制越界或含非法字符时.
 */
function convertRadix(
  input: string,
  inBase: number,
  outBase: number,
  hex: HexOptions,
): string {
  if (inBase < 2 || inBase > 36 || outBase < 2 || outBase > 36) {
    throw new Error("进制需在 2-36 之间");
  }
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  let value = 0n;
  if (inBase === 16) {
    const cleaned = stripHexFormat(body);
    if (cleaned.length === 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
      throw new Error("含非法十六进制字符");
    }
    value = BigInt("0x" + cleaned);
  } else {
    const digits = body.toLowerCase();
    if (digits.length === 0) {
      throw new Error("空数值");
    }
    const base = BigInt(inBase);
    for (const ch of digits) {
      const d = Number.parseInt(ch, 36);
      if (Number.isNaN(d) || d >= inBase) {
        throw new Error(`字符 ${ch} 不属于 ${inBase} 进制`);
      }
      value = value * base + BigInt(d);
    }
  }
  const sign = negative ? "-" : "";
  if (outBase === 16) {
    return sign + renderHex(bigIntToBytes(value), hex);
  }
  return sign + value.toString(outBase);
}

/**
 * 进制转换 codec (from/to 选项; 方向不区分, encode/decode 行为一致).
 */
export const RADIX_CODECS: readonly CodecDef[] = [
  {
    id: "radix",
    label: "进制转换",
    group: "number",
    needsCharset: false,
    options: [
      {
        id: "from",
        label: "源进制",
        choices: RADIX_CHOICES,
        defaultValue: "10",
      },
      {
        id: "to",
        label: "目标进制",
        choices: RADIX_CHOICES,
        defaultValue: "16",
      },
    ],
    encode: (input, ctx) => {
      try {
        return ok(
          convertRadix(
            input,
            Number(ctx.options.from ?? "10"),
            Number(ctx.options.to ?? "16"),
            ctx.hex,
          ),
        );
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
    decode: (input, ctx) => {
      try {
        return ok(
          convertRadix(
            input,
            Number(ctx.options.to ?? "16"),
            Number(ctx.options.from ?? "10"),
            ctx.hex,
          ),
        );
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
