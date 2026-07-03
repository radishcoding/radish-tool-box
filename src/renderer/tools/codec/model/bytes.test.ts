import { describe, expect, it } from "vitest";

import {
  ascii85ToBytes,
  base32ToBytes,
  base58ToBytes,
  base62ToBytes,
  bytesToAscii85,
  bytesToBase32,
  bytesToBase58,
  bytesToBase62,
} from "./bytes";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);

describe("bytes 编解码算法", () => {
  it("Base32 RFC4648 已知向量", () => {
    expect(bytesToBase32(enc("foobar"))).toBe("MZXW6YTBOI======");
    expect(dec(base32ToBytes("MZXW6YTBOI======"))).toBe("foobar");
  });

  it("Base58 含前导零字节", () => {
    const bytes = Uint8Array.from([0, 0, 1, 2, 3]);
    expect(base58ToBytes(bytesToBase58(bytes))).toEqual(bytes);
  });

  it("Base62 往返", () => {
    expect(dec(base62ToBytes(bytesToBase62(enc("Hello, 世界"))))).toBe(
      "Hello, 世界",
    );
  });

  it("Ascii85 全零组用 z 缩写并可还原", () => {
    const zeros = new Uint8Array(4);
    expect(bytesToAscii85(zeros)).toBe("z");
    expect(ascii85ToBytes("z")).toEqual(zeros);
    expect(dec(ascii85ToBytes(bytesToAscii85(enc("Man "))))).toBe("Man ");
  });

  it("非法字符抛错", () => {
    expect(() => base32ToBytes("0189")).toThrow();
    expect(() => base58ToBytes("0OIl")).toThrow();
  });

  // --- 补充边界用例 ---

  it("空输入 Base32 往返得空串/空字节", () => {
    expect(bytesToBase32(new Uint8Array(0))).toBe("");
    expect(base32ToBytes("")).toEqual(new Uint8Array(0));
  });

  it("空输入 Base58 往返得空串/空字节", () => {
    expect(bytesToBase58(new Uint8Array(0))).toBe("");
    expect(base58ToBytes("")).toEqual(new Uint8Array(0));
  });

  it("空输入 Base62 往返得空串/空字节", () => {
    expect(bytesToBase62(new Uint8Array(0))).toBe("");
    expect(base62ToBytes("")).toEqual(new Uint8Array(0));
  });

  it("空输入 Ascii85 往返得空串/空字节", () => {
    expect(bytesToAscii85(new Uint8Array(0))).toBe("");
    expect(ascii85ToBytes("")).toEqual(new Uint8Array(0));
  });

  it("多字节中文经 UTF-8 做 Base32 往返一致", () => {
    const text = "你好世界";
    expect(dec(base32ToBytes(bytesToBase32(enc(text))))).toBe(text);
  });

  it("多字节中文经 UTF-8 做 Base58 往返一致", () => {
    const text = "你好世界";
    expect(dec(base58ToBytes(bytesToBase58(enc(text))))).toBe(text);
  });

  it("多字节中文经 UTF-8 做 Base62 往返一致", () => {
    const text = "你好世界";
    expect(dec(base62ToBytes(bytesToBase62(enc(text))))).toBe(text);
  });

  it("多字节中文经 UTF-8 做 Ascii85 往返一致", () => {
    const text = "你好世界";
    expect(dec(ascii85ToBytes(bytesToAscii85(enc(text))))).toBe(text);
  });

  // --- 全零字节边界用例 (修复 baseEncode/Decode 哨兵缺陷) ---

  it("Base58 全零字节往返精确一致", () => {
    const zeros = Uint8Array.from([0, 0, 0]);
    expect(bytesToBase58(zeros)).toBe("111");
    expect(base58ToBytes("111")).toEqual(zeros);
  });

  it("Base62 全零字节往返精确一致", () => {
    const zeros = Uint8Array.from([0, 0, 0]);
    expect(bytesToBase62(zeros)).toBe("000");
    expect(base62ToBytes("000")).toEqual(zeros);
  });

  it("Ascii85 <~ ~> 包裹后可正确解码", () => {
    const bytes = enc("Man ");
    const wrapped = `<~${bytesToAscii85(bytes)}~>`;
    expect(ascii85ToBytes(wrapped)).toEqual(bytes);
  });
});
