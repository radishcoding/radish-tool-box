/**
 * 十六进制字符表, 索引即字节高/低半字节值.
 */
const HEX_DIGITS = "0123456789abcdef";

/**
 * 字节数组转小写无分隔的十六进制字符串.
 * @param bytes 输入字节.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += HEX_DIGITS[byte >> 4] + HEX_DIGITS[byte & 0x0f];
  }
  return out;
}

/**
 * 十六进制字符串转字节数组, 容忍大小写, 忽略首尾空白.
 * @param hex 十六进制文本.
 * @throws Error 长度为奇数或含非十六进制字符时.
 */
export function hexToBytes(hex: string): Uint8Array {
  const trimmed = hex.trim();
  if (trimmed.length % 2 !== 0) {
    throw new Error("十六进制长度应为偶数");
  }
  const bytes = new Uint8Array(trimmed.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = Number.parseInt(trimmed.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("含非法十六进制字符");
    }
    bytes[index] = byte;
  }
  return bytes;
}

/**
 * 解析十六进制文本: 先剥除 "0x" 前缀, 空白与常见分隔符 (空格/换行/-/:/,/{}) 再转字节.
 * 可容忍 "AB CD", "0xAB,0xCD", "{ 0xAB, 0xCD }" 等多种显示格式的回填.
 * @param text 可能带分隔符的十六进制文本.
 * @throws Error 剥离后长度为奇数或含非法字符时.
 */
export function parseHex(text: string): Uint8Array {
  return hexToBytes(text.replace(/0x/gi, "").replace(/[\s:_,{}-]+/g, ""));
}

/**
 * 字节数组转标准 base64 (带 = 填充).
 * @param bytes 输入字节.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * 标准 base64 转字节数组.
 * @param value base64 文本.
 * @throws Error 含非法 base64 字符时.
 */
export function base64ToBytes(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value.trim());
  } catch {
    throw new Error("非法 base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
