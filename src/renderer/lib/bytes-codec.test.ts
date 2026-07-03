import { describe, expect, it } from "vitest";

import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
  parseHex,
} from "./bytes-codec";

describe("bytes-codec 基础往返", () => {
  it("hex 往返", () => {
    const bytes = new Uint8Array([0x00, 0xd6, 0xd0, 0xff]);
    expect(bytesToHex(bytes)).toBe("00d6d0ff");
    expect(Array.from(hexToBytes("00d6d0ff"))).toEqual([0, 0xd6, 0xd0, 0xff]);
  });

  it("base64 往返", () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([
      1, 2, 3, 250,
    ]);
  });

  it("hexToBytes 拒绝奇数长度", () => {
    expect(() => hexToBytes("abc")).toThrow("十六进制长度应为偶数");
  });

  it("parseHex 容忍空白, 分隔符, 0x 前缀与数组括号", () => {
    expect(Array.from(parseHex("D6 D0\n0F"))).toEqual([0xd6, 0xd0, 0x0f]);
    expect(Array.from(parseHex("d6-d0-0f"))).toEqual([0xd6, 0xd0, 0x0f]);
    expect(Array.from(parseHex("{ 0xD6, 0xD0, 0x0F }"))).toEqual([
      0xd6, 0xd0, 0x0f,
    ]);
  });
});
