import { describe, expect, it } from "vitest";

import { runCodec } from "../run";

const ctx = {
  charset: "utf-8",
  hex: { upperCase: false, format: "none" as const },
  options: {},
};

describe("传输/趣味 codec", () => {
  it("Quoted-Printable 编解码 (含中文与等号)", () => {
    const enc = runCodec("quoted-printable", "encode", "a=b 中", ctx);
    expect(enc.output).toContain("=3D");
    expect(runCodec("quoted-printable", "decode", enc.output, ctx).output).toBe(
      "a=b 中",
    );
  });

  it("QP 软换行 decode 后被拼接", () => {
    // =\r\n 与 =\n 均视为软换行, decode 后消失
    expect(
      runCodec("quoted-printable", "decode", "hel=\r\nlo", ctx).output,
    ).toBe("hello");
    expect(runCodec("quoted-printable", "decode", "hel=\nlo", ctx).output).toBe(
      "hello",
    );
  });

  it("QP 非法转义 decode 返回 error", () => {
    // =3X: Number.parseInt("3X", 16) 返回 3 而非 NaN, 必须用正则校验
    const r = runCodec("quoted-printable", "decode", "=3X", ctx);
    expect(r.error).not.toBe("");
  });

  it("Punycode 域名 IDN", () => {
    expect(runCodec("punycode", "encode", "中文.com", ctx).output).toBe(
      "xn--fiq228c.com",
    );
    expect(runCodec("punycode", "decode", "xn--fiq228c.com", ctx).output).toBe(
      "中文.com",
    );
  });

  it("Punycode 非法输入 decode 返回 error", () => {
    // toUnicode("xn--♠") 抛 "Invalid input"
    const r = runCodec("punycode", "decode", "xn--♠", ctx);
    expect(r.error).not.toBe("");
  });

  it("ROT13 自反", () => {
    const r = runCodec("rot13", "encode", "Hello", ctx);
    expect(r.output).toBe("Uryyb");
    expect(runCodec("rot13", "decode", r.output, ctx).output).toBe("Hello");
  });

  it("ROT13 非字母不变", () => {
    expect(runCodec("rot13", "encode", "123 !@#", ctx).output).toBe("123 !@#");
  });

  it("摩尔斯电码", () => {
    const r = runCodec("morse", "encode", "SOS", ctx);
    expect(r.output).toBe("... --- ...");
    expect(runCodec("morse", "decode", r.output, ctx).output).toBe("SOS");
  });

  it("Morse 非法码 decode 返回 error", () => {
    // 八个点不在码表中
    const r = runCodec("morse", "decode", "........", ctx);
    expect(r.error).not.toBe("");
  });

  it("Morse 不支持字符 encode 返回 error", () => {
    // 中文字符不在 MORSE_MAP 中
    const r = runCodec("morse", "encode", "中", ctx);
    expect(r.error).not.toBe("");
  });
});
