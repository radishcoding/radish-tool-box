/**
 * Base32 默认字母表 (RFC4648, 大写 A-Z 与数字 2-7).
 */
export const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Base58 默认字母表 (Bitcoin 顺序, 去除易混字符 0OIl).
 */
export const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Base62 默认字母表 (0-9A-Za-z).
 */
export const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Ascii85 默认字母表 (码点 33-117, 即 '!'..'u' 共 85 个).
 */
export const ASCII85_ALPHABET = Array.from({ length: 85 }, (_unused, i) =>
  String.fromCharCode(33 + i),
).join("");

/**
 * 把字节数组编码为 Base32 (带 = 填充).
 * @param bytes 输入字节.
 * @param alphabet 32 字符的码表, 缺省为 RFC4648 默认表.
 * @returns Base32 字符串.
 */
export function bytesToBase32(
  bytes: Uint8Array,
  alphabet: string = BASE32_ALPHABET,
): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31];
  }
  while (out.length % 8 !== 0) {
    out += "=";
  }
  return out;
}

/**
 * 把 Base32 字符串解码为字节数组 (忽略空白与尾部填充).
 * 仅默认码表时容忍小写 (转大写); 自定义码表按原样大小写匹配.
 * @param input Base32 文本.
 * @param alphabet 32 字符的码表, 缺省为 RFC4648 默认表.
 * @returns 解码字节.
 * @throws Error 含非法 Base32 字符时.
 */
export function base32ToBytes(
  input: string,
  alphabet: string = BASE32_ALPHABET,
): Uint8Array {
  let clean = input.replace(/=+$/g, "").replace(/\s+/g, "");
  if (alphabet === BASE32_ALPHABET) {
    clean = clean.toUpperCase();
  }
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const index = alphabet.indexOf(ch);
    if (index === -1) {
      throw new Error("含非法 Base32 字符");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/**
 * 按给定字母表做大整数进制编码 (保留前导零字节).
 * @param bytes 输入字节.
 * @param alphabet 目标字母表.
 * @returns 编码字符串.
 */
function baseEncode(bytes: Uint8Array, alphabet: string): string {
  if (bytes.length === 0) {
    return "";
  }
  const base = alphabet.length;
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % base;
      carry = Math.floor(carry / base);
    }
    while (carry > 0) {
      digits.push(carry % base);
      carry = Math.floor(carry / base);
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte === 0) {
      out += alphabet[0];
    } else {
      break;
    }
  }
  // 剥除高位零: 全零输入时有效位数为 0, 不输出任何 magnitude 字符.
  let high = digits.length;
  while (high > 0 && digits[high - 1] === 0) {
    high -= 1;
  }
  for (let i = high - 1; i >= 0; i -= 1) {
    out += alphabet[digits[i]];
  }
  return out;
}

/**
 * 按给定字母表把进制字符串解码为字节 (保留前导零字节).
 * @param input 输入字符串.
 * @param alphabet 字母表.
 * @returns 解码字节.
 * @throws Error 含非法字符时.
 */
function baseDecode(input: string, alphabet: string): Uint8Array {
  const clean = input.replace(/\s+/g, "");
  if (clean.length === 0) {
    return new Uint8Array(0);
  }
  const base = alphabet.length;
  const bytes: number[] = [0];
  for (const ch of clean) {
    const value = alphabet.indexOf(ch);
    if (value === -1) {
      throw new Error("含非法字符");
    }
    let carry = value;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * base;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leading = 0;
  for (const ch of clean) {
    if (ch === alphabet[0]) {
      leading += 1;
    } else {
      break;
    }
  }
  // 剥除高位零: 全零输入时有效字节数为 0, 结果仅保留前导零字节.
  let high = bytes.length;
  while (high > 0 && bytes[high - 1] === 0) {
    high -= 1;
  }
  const result = new Uint8Array(leading + high);
  for (let i = 0; i < high; i += 1) {
    result[leading + i] = bytes[high - 1 - i];
  }
  return result;
}

/**
 * 把字节数组编码为 Base58.
 * @param bytes 输入字节.
 * @param alphabet 58 字符的码表, 缺省为 Bitcoin 默认表.
 * @returns Base58 字符串.
 */
export function bytesToBase58(
  bytes: Uint8Array,
  alphabet: string = BASE58_ALPHABET,
): string {
  return baseEncode(bytes, alphabet);
}

/**
 * 把 Base58 字符串解码为字节.
 * @param input Base58 文本.
 * @param alphabet 58 字符的码表, 缺省为 Bitcoin 默认表.
 * @returns 解码字节.
 * @throws Error 含非法 Base58 字符时.
 */
export function base58ToBytes(
  input: string,
  alphabet: string = BASE58_ALPHABET,
): Uint8Array {
  return baseDecode(input, alphabet);
}

/**
 * 把字节数组编码为 Base62.
 * @param bytes 输入字节.
 * @param alphabet 62 字符的码表, 缺省为 0-9A-Za-z 默认表.
 * @returns Base62 字符串.
 */
export function bytesToBase62(
  bytes: Uint8Array,
  alphabet: string = BASE62_ALPHABET,
): string {
  return baseEncode(bytes, alphabet);
}

/**
 * 把 Base62 字符串解码为字节.
 * @param input Base62 文本.
 * @param alphabet 62 字符的码表, 缺省为 0-9A-Za-z 默认表.
 * @returns 解码字节.
 * @throws Error 含非法 Base62 字符时.
 */
export function base62ToBytes(
  input: string,
  alphabet: string = BASE62_ALPHABET,
): Uint8Array {
  return baseDecode(input, alphabet);
}

/**
 * 把字节数组编码为 Ascii85 (不加 <~ ~> 包裹).
 * 仅默认码表时对全零四字节组用 z 缩写; 自定义码表禁用 z 缩写.
 * @param bytes 输入字节.
 * @param alphabet 85 字符的码表, 缺省为 Adobe 默认表 ('!'..'u').
 * @returns Ascii85 字符串.
 */
export function bytesToAscii85(
  bytes: Uint8Array,
  alphabet: string = ASCII85_ALPHABET,
): string {
  const allowZ = alphabet === ASCII85_ALPHABET;
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const len = chunk.length;
    let num = 0;
    for (let j = 0; j < 4; j += 1) {
      num = num * 256 + (j < len ? chunk[j] : 0);
    }
    if (allowZ && len === 4 && num === 0) {
      out += "z";
      continue;
    }
    const group: string[] = [];
    let n = num;
    for (let j = 0; j < 5; j += 1) {
      group.unshift(alphabet[n % 85]);
      n = Math.floor(n / 85);
    }
    out += group.slice(0, len + 1).join("");
  }
  return out;
}

/**
 * 把 Ascii85 字符串解码为字节 (容忍 <~ ~> 包裹与空白).
 * 仅默认码表时识别 z 缩写; 自定义码表按码表索引匹配.
 * @param input Ascii85 文本.
 * @param alphabet 85 字符的码表, 缺省为 Adobe 默认表 ('!'..'u').
 * @returns 解码字节.
 * @throws Error 含非法 Ascii85 字符时.
 */
export function ascii85ToBytes(
  input: string,
  alphabet: string = ASCII85_ALPHABET,
): Uint8Array {
  const allowZ = alphabet === ASCII85_ALPHABET;
  let s = input.trim();
  if (s.startsWith("<~")) {
    s = s.slice(2);
  }
  if (s.endsWith("~>")) {
    s = s.slice(0, -2);
  }
  s = s.replace(/\s+/g, "");
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    if (allowZ && s[i] === "z") {
      out.push(0, 0, 0, 0);
      i += 1;
      continue;
    }
    const group: number[] = [];
    while (group.length < 5 && i < s.length && !(allowZ && s[i] === "z")) {
      const index = alphabet.indexOf(s[i]);
      if (index === -1) {
        throw new Error("含非法 Ascii85 字符");
      }
      group.push(index);
      i += 1;
    }
    const len = group.length;
    while (group.length < 5) {
      group.push(84);
    }
    let num = 0;
    for (const g of group) {
      num = num * 85 + g;
    }
    const groupBytes = [
      Math.floor(num / 16777216) % 256,
      Math.floor(num / 65536) % 256,
      Math.floor(num / 256) % 256,
      num % 256,
    ];
    for (let k = 0; k < len - 1; k += 1) {
      out.push(groupBytes[k]);
    }
  }
  return Uint8Array.from(out);
}
