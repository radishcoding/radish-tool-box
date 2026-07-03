export type { Diagnostic, Outcome } from "@/lib/outcome";
export { ok, fail } from "@/lib/outcome";

/**
 * 字段级字节编码: 输入输出框在这三种表示间切换.
 */
export type ByteEncoding = "utf8" | "hex" | "base64";

/**
 * 带编码标记的字节文本, 经 codec 解码为真实字节.
 */
export interface EncodedBytes {
  readonly text: string;
  readonly encoding: ByteEncoding;
}

/**
 * 算法功能大类, 决定左侧导航与右侧面板.
 */
export type AlgorithmCategory =
  | "hash"
  | "hmac"
  | "symmetric"
  | "asymmetric"
  | "kdf";

/**
 * 参数非法/解码失败/库报错的归一错误类型.
 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}
