import { describe, expect, it } from "vitest";

import { runCodec } from "../run";

const ctx = {
  charset: "utf-8",
  hex: { upperCase: false, format: "none" as const },
  options: {},
};

describe("Web/转义/进制 codec", () => {
  it("URL 组件编解码", () => {
    const r = runCodec("url", "encode", "a b&c=中", ctx);
    expect(r.output).toBe("a%20b%26c%3D%E4%B8%AD");
    expect(runCodec("url", "decode", r.output, ctx).output).toBe("a b&c=中");
  });

  it("URL 编码随字符集变化 (GBK vs UTF-8)", () => {
    const gbk = { ...ctx, charset: "gbk" };
    expect(runCodec("url", "encode", "牛逼", gbk).output).toBe("%C5%A3%B1%C6");
    expect(runCodec("url", "encode", "牛逼", ctx).output).toBe(
      "%E7%89%9B%E9%80%BC",
    );
    expect(runCodec("url", "decode", "%C5%A3%B1%C6", gbk).output).toBe("牛逼");
    expect(runCodec("url", "decode", "%E7%89%9B%E9%80%BC", ctx).output).toBe(
      "牛逼",
    );
  });

  it("HTML 实体编解码", () => {
    const r = runCodec("html", "encode", '<a> & "x"', ctx);
    expect(runCodec("html", "decode", r.output, ctx).output).toBe('<a> & "x"');
  });

  it("Unicode 转义往返", () => {
    const r = runCodec("unicode-escape", "encode", "A中", ctx);
    expect(r.output).toBe("\\u0041\\u4e2d");
    expect(runCodec("unicode-escape", "decode", r.output, ctx).output).toBe(
      "A中",
    );
  });

  it("JS 字符串转义", () => {
    const r = runCodec("js-escape", "encode", 'a\n"b"\t', ctx);
    expect(r.output).toBe('a\\n\\"b\\"\\t');
    expect(runCodec("js-escape", "decode", r.output, ctx).output).toBe(
      'a\n"b"\t',
    );
  });

  it("进制转换 十进制 -> 十六进制", () => {
    const r = runCodec("radix", "encode", "255", {
      ...ctx,
      options: { from: "10", to: "16" },
    });
    expect(r.output).toBe("ff");
  });

  it("进制转换 非法字符报错", () => {
    const r = runCodec("radix", "encode", "xyz", {
      ...ctx,
      options: { from: "10", to: "16" },
    });
    expect(r.error).not.toBe("");
  });

  it("进制转 16 时套用 hex 显示形态, 且容忍带格式 hex 输入", () => {
    const options = { from: "10", to: "16" };
    expect(
      runCodec("radix", "encode", "255", {
        ...ctx,
        options,
        hex: { upperCase: true, format: "array-hex" },
      }).output,
    ).toBe("{ 0xFF }");
    expect(
      runCodec("radix", "encode", "255", {
        ...ctx,
        options,
        hex: { upperCase: false, format: "space" },
      }).output,
    ).toBe("ff");
    // 带 0x/花括号格式的 hex 可作为 16 进制输入解析回十进制
    expect(
      runCodec("radix", "encode", "{ 0xFF }", {
        ...ctx,
        options: { from: "16", to: "10" },
      }).output,
    ).toBe("255");
  });

  it("URL full 模式 encode 不编码结构字符, decode 还原", () => {
    const input = "https://a.com/x y?q=1&r=2";
    const fullCtx = { ...ctx, options: { mode: "full" } };
    const r = runCodec("url", "encode", input, fullCtx);
    // encodeURI 不编码 :/?&= 但把空格编为 %20
    expect(r.output).toBe("https://a.com/x%20y?q=1&r=2");
    // decode full 还原
    expect(runCodec("url", "decode", r.output, fullCtx).output).toBe(input);
  });

  it("URL decode 非法百分号返回 error", () => {
    const r = runCodec("url", "decode", "%ZZ", ctx);
    expect(r.error).not.toBe("");
  });

  it("radix decode 往返: 十进制 -> 十六进制 -> 十进制", () => {
    const radixCtx = { ...ctx, options: { from: "10", to: "16" } };
    const encoded = runCodec("radix", "encode", "255", radixCtx);
    expect(encoded.output).toBe("ff");
    // decode 是反向 (to->from), 即 16->10
    const decoded = runCodec("radix", "decode", encoded.output, radixCtx);
    expect(decoded.output).toBe("255");
  });

  it("radix 负数: -5 十进制转二进制", () => {
    const r = runCodec("radix", "encode", "-5", {
      ...ctx,
      options: { from: "10", to: "2" },
    });
    expect(r.output).toBe("-101");
  });

  it("HTML scope=all 全部实体化且 decode 还原", () => {
    const input = 'Hi <中> & "世界"';
    const allCtx = { ...ctx, options: { scope: "all" } };
    const encoded = runCodec("html", "encode", input, allCtx);
    // scope=all 时原中文字符不应出现在输出中
    expect(encoded.output).not.toMatch(/[一-鿿]/);
    // decode 还原
    expect(runCodec("html", "decode", encoded.output, allCtx).output).toBe(
      input,
    );
  });
});
