import {
  base64ToBytes as sharedBase64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes as sharedHexToBytes,
} from "@/lib/bytes-codec";

import { CryptoError, type ByteEncoding, type EncodedBytes } from "./types";

/**
 * 模块级 TextEncoder 单例, 避免每次调用 utf8ToBytes 重新构造.
 */
const TEXT_ENCODER = new TextEncoder();

/**
 * 模块级 TextDecoder 单例, 避免每次调用 bytesToUtf8 重新构造.
 */
const TEXT_DECODER = new TextDecoder();

export { bytesToBase64, bytesToHex };

/**
 * 十六进制字符串转字节, 失败归一为 CryptoError.
 * @param hex 十六进制文本.
 */
export function hexToBytes(hex: string): Uint8Array {
  try {
    return sharedHexToBytes(hex);
  } catch (error) {
    throw new CryptoError(
      error instanceof Error ? error.message : "非法十六进制",
    );
  }
}

/**
 * base64 转字节, 失败归一为 CryptoError.
 * @param value base64 文本.
 */
export function base64ToBytes(value: string): Uint8Array {
  try {
    return sharedBase64ToBytes(value);
  } catch (error) {
    throw new CryptoError(
      error instanceof Error ? error.message : "非法 base64",
    );
  }
}

/**
 * UTF-8 文本转字节.
 * @param text 输入文本.
 */
export function utf8ToBytes(text: string): Uint8Array {
  return TEXT_ENCODER.encode(text);
}

/**
 * 字节转 UTF-8 文本.
 * @param bytes 输入字节.
 */
export function bytesToUtf8(bytes: Uint8Array): string {
  return TEXT_DECODER.decode(bytes);
}

/**
 * 按编码标记把文本解码为字节.
 * @param input 带编码的文本.
 * @throws CryptoError 文本与编码不匹配时.
 */
export function decode(input: EncodedBytes): Uint8Array {
  switch (input.encoding) {
    case "hex":
      return hexToBytes(input.text);
    case "base64":
      return base64ToBytes(input.text);
    case "utf8":
      return utf8ToBytes(input.text);
    default: {
      const exhaustive: never = input.encoding;
      throw new CryptoError(`未知编码: ${String(exhaustive)}`);
    }
  }
}

/**
 * 把字节按指定编码生成文本.
 * @param bytes 输入字节.
 * @param encoding 目标编码.
 */
export function encode(bytes: Uint8Array, encoding: ByteEncoding): string {
  switch (encoding) {
    case "hex":
      return bytesToHex(bytes);
    case "base64":
      return bytesToBase64(bytes);
    case "utf8":
      return bytesToUtf8(bytes);
    default: {
      const exhaustive: never = encoding;
      throw new CryptoError(`未知编码: ${String(exhaustive)}`);
    }
  }
}
