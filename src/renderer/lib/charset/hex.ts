/**
 * Hex 字节的显示格式:
 * - none/space/dash: 纯十六进制, 分别用 无/空格/连字符 分隔.
 * - array-hex: C 风格数组, 如 "{ 0xE4, 0xB8, 0xAD }".
 * - array-dec: 十进制数组, 如 "{ 228, 184, 173 }".
 */
export type HexFormat = "none" | "space" | "dash" | "array-hex" | "array-dec";

/**
 * Hex 形态的显示选项.
 */
export interface HexOptions {
  readonly upperCase: boolean;
  readonly format: HexFormat;
}

/**
 * 十六进制字符表, 索引即字节高/低半字节值.
 */
const HEX_DIGITS = "0123456789abcdef";

/**
 * 单字节转两位十六进制 (按需大写).
 * @param byte 字节值.
 * @param upperCase 是否大写.
 * @returns 两位十六进制字符串.
 */
function byteToHex(byte: number, upperCase: boolean): string {
  const pair = HEX_DIGITS[byte >> 4] + HEX_DIGITS[byte & 0x0f];
  return upperCase ? pair.toUpperCase() : pair;
}

/**
 * 把字节数组按 Hex 显示选项渲染为文本.
 * 空字节返回空串; 数组形态如 "{ 0xE4, 0xB8, 0xAD }" 或 "{ 228, 184, 173 }".
 * @param bytes 输入字节.
 * @param options Hex 显示选项 (大小写 + 格式).
 * @returns 渲染后的文本.
 */
export function renderHex(bytes: Uint8Array, options: HexOptions): string {
  if (bytes.length === 0) {
    return "";
  }
  switch (options.format) {
    case "none":
      return Array.from(bytes, (b) => byteToHex(b, options.upperCase)).join("");
    case "space":
      return Array.from(bytes, (b) => byteToHex(b, options.upperCase)).join(
        " ",
      );
    case "dash":
      return Array.from(bytes, (b) => byteToHex(b, options.upperCase)).join(
        "-",
      );
    case "array-hex":
      return `{ ${Array.from(bytes, (b) => `0x${byteToHex(b, options.upperCase)}`).join(", ")} }`;
    case "array-dec":
      return `{ ${Array.from(bytes, (b) => String(b)).join(", ")} }`;
    default: {
      const exhaustive: never = options.format;
      throw new Error(`未知 Hex 格式: ${String(exhaustive)}`);
    }
  }
}
