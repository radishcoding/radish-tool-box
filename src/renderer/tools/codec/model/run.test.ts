import { describe, expect, it } from "vitest";

import { runCodec } from "./run";

const ctx = {
  charset: "utf-8",
  hex: { upperCase: false, format: "none" as const },
  options: {},
};

describe("runCodec 编排", () => {
  it("未知 codec 返回错误", () => {
    expect(runCodec("nope", "encode", "x", ctx).error).toBe("未知编解码");
  });

  it("空输入返回空结果不报错", () => {
    expect(runCodec("base64", "encode", "", ctx).error).toBe("");
    expect(runCodec("base64", "encode", "", ctx).output).toBe("");
  });
});
