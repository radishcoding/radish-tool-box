export type { Diagnostic } from "@/lib/outcome";
export type { HexFormat, HexOptions } from "@/lib/charset/hex";

/**
 * 数据形态: 源/目标两侧通用.
 */
export type Form = "text" | "hex" | "base64" | "unicode";

/**
 * 单侧 (源或目标) 的状态: 形态 + 字符集 + 文本内容.
 */
export interface SideState {
  readonly form: Form;
  readonly charset: string;
  readonly text: string;
}

/**
 * 编码转换过程中参数非法/解码失败/库报错的归一错误类型.
 */
export class EncodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncodingError";
  }
}

/**
 * 判断某形态是否需要字符集.
 * - hex/base64: 字节序列, 需字符集解释.
 * - text: 可读文本, 需字符集以支持 "文本 -> 文本" 的字节往返 (转码/乱码视图).
 * - unicode: 码点本身, 不依赖字符集.
 * @param form 数据形态.
 */
export function formNeedsCharset(form: Form): boolean {
  return form === "hex" || form === "base64" || form === "text";
}
