import { describe, expect, it } from "vitest";

import { CryptoError } from "./types";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  decode,
  encode,
  hexToBytes,
  utf8ToBytes,
} from "./codec";

describe("codec hex", () => {
  it("字节转十六进制小写无分隔", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 16, 255]))).toBe("000110ff");
  });

  it("十六进制转字节, 容忍大小写", () => {
    expect(hexToBytes("00FF10")).toEqual(new Uint8Array([0, 255, 16]));
  });

  it("奇数长度十六进制抛 CryptoError", () => {
    expect(() => hexToBytes("abc")).toThrow(CryptoError);
  });

  it("非法字符十六进制抛 CryptoError", () => {
    expect(() => hexToBytes("zz")).toThrow(CryptoError);
  });
});

describe("codec base64", () => {
  it("字节转 base64", () => {
    expect(bytesToBase64(utf8ToBytes("hello"))).toBe("aGVsbG8=");
  });

  it("base64 转字节", () => {
    expect(bytesToUtf8(base64ToBytes("aGVsbG8="))).toBe("hello");
  });

  it("非法 base64 抛 CryptoError", () => {
    expect(() => base64ToBytes("@@@")).toThrow(CryptoError);
  });
});

describe("codec utf8", () => {
  it("utf8 与字节往返, 含多字节字符", () => {
    const bytes = utf8ToBytes("萝卜A");
    expect(bytesToUtf8(bytes)).toBe("萝卜A");
  });

  it("ASCII 字符字节值正确", () => {
    expect(bytesToHex(utf8ToBytes("A"))).toBe("41");
  });
});

describe("codec decode/encode", () => {
  it("按编码解码", () => {
    expect(bytesToHex(decode({ text: "41", encoding: "hex" }))).toBe("41");
    expect(bytesToUtf8(decode({ text: "A", encoding: "utf8" }))).toBe("A");
  });

  it("decode base64 路径正确解出原文", () => {
    expect(bytesToUtf8(decode({ text: "aGVsbG8=", encoding: "base64" }))).toBe(
      "hello",
    );
  });

  it("按编码生成文本", () => {
    const bytes = utf8ToBytes("hello");
    expect(encode(bytes, "hex")).toBe("68656c6c6f");
    expect(encode(bytes, "base64")).toBe("aGVsbG8=");
    expect(encode(bytes, "utf8")).toBe("hello");
  });
});
