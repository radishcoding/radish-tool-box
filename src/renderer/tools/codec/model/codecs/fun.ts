import { fail, ok } from "@/lib/outcome";

import type { CodecDef } from "../types";

/**
 * 对单段文本做 ROT13 (仅影响 A-Za-z).
 * @param input 原文.
 * @returns ROT13 文本.
 */
function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/**
 * 摩尔斯码表 (字符 -> 码).
 */
const MORSE_MAP: Readonly<Record<string, string>> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
  " ": "/",
};

/**
 * 摩尔斯码表 (码 -> 字符), 由 MORSE_MAP 反转得到.
 */
const MORSE_REVERSE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([k, v]) => [v, k]),
);

/**
 * 把文本编码为摩尔斯电码 (字母间空格分隔, 空格用 /).
 * @param input 原文.
 * @returns 摩尔斯文本.
 * @throws Error 含不支持字符时.
 */
function morseEncode(input: string): string {
  return Array.from(input.toUpperCase(), (ch) => {
    const code = MORSE_MAP[ch];
    if (code === undefined) {
      throw new Error(`不支持的字符: ${ch}`);
    }
    return code;
  }).join(" ");
}

/**
 * 把摩尔斯电码解码为文本.
 * @param input 摩尔斯文本.
 * @returns 原文.
 * @throws Error 含非法码时.
 */
function morseDecode(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((code) => {
      const ch = MORSE_REVERSE[code];
      if (ch === undefined) {
        throw new Error(`非法摩尔斯码: ${code}`);
      }
      return ch;
    })
    .join("");
}

/**
 * 趣味类 codec: ROT13 与摩尔斯电码.
 */
export const FUN_CODECS: readonly CodecDef[] = [
  {
    id: "rot13",
    label: "ROT13",
    group: "fun",
    needsCharset: false,
    encode: (input) => ok(rot13(input)),
    decode: (input) => ok(rot13(input)),
  },
  {
    id: "morse",
    label: "摩尔斯电码",
    group: "fun",
    needsCharset: false,
    encode: (input) => {
      try {
        return ok(morseEncode(input));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
    decode: (input) => {
      try {
        return ok(morseDecode(input));
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
