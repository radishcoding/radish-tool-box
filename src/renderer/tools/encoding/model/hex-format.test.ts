import { describe, expect, it } from "vitest";

import { renderHex } from "./hex-format";

const BYTES = new Uint8Array([0xe4, 0xb8, 0x0a]);

describe("renderHex 各格式", () => {
  it("none 小写/大写", () => {
    expect(renderHex(BYTES, { upperCase: false, format: "none" })).toBe(
      "e4b80a",
    );
    expect(renderHex(BYTES, { upperCase: true, format: "none" })).toBe(
      "E4B80A",
    );
  });

  it("space 小写/大写", () => {
    expect(renderHex(BYTES, { upperCase: false, format: "space" })).toBe(
      "e4 b8 0a",
    );
    expect(renderHex(BYTES, { upperCase: true, format: "space" })).toBe(
      "E4 B8 0A",
    );
  });

  it("dash 小写/大写", () => {
    expect(renderHex(BYTES, { upperCase: false, format: "dash" })).toBe(
      "e4-b8-0a",
    );
    expect(renderHex(BYTES, { upperCase: true, format: "dash" })).toBe(
      "E4-B8-0A",
    );
  });

  it("array-hex 小写/大写", () => {
    expect(renderHex(BYTES, { upperCase: false, format: "array-hex" })).toBe(
      "{ 0xe4, 0xb8, 0x0a }",
    );
    expect(renderHex(BYTES, { upperCase: true, format: "array-hex" })).toBe(
      "{ 0xE4, 0xB8, 0x0A }",
    );
  });

  it("array-dec 不受大小写影响", () => {
    expect(renderHex(BYTES, { upperCase: false, format: "array-dec" })).toBe(
      "{ 228, 184, 10 }",
    );
    expect(renderHex(BYTES, { upperCase: true, format: "array-dec" })).toBe(
      "{ 228, 184, 10 }",
    );
  });

  it("空字节各格式均返回空串", () => {
    const empty = new Uint8Array(0);
    for (const format of [
      "none",
      "space",
      "dash",
      "array-hex",
      "array-dec",
    ] as const) {
      expect(renderHex(empty, { upperCase: false, format })).toBe("");
    }
  });
});
