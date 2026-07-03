import { describe, expect, it } from "vitest";

import { toResultView } from "./result-view";
import { fail, ok } from "./types";

describe("toResultView", () => {
  it("成功结果按编码生成输出文本, error 为空, diagnostics 透传", () => {
    const view = toResultView(ok(new Uint8Array([104, 105])), "hex");
    expect(view.output).toBe("6869");
    expect(view.error).toBe("");
    expect(view.diagnostics).toHaveLength(0);
  });

  it("成功结果携带诊断时 diagnostics 被透传", () => {
    const diag = [{ level: "info" as const, message: "x" }];
    const view = toResultView(ok(new Uint8Array([0]), diag), "hex");
    expect(view.output).toBe("00");
    expect(view.error).toBe("");
    expect(view.diagnostics).toHaveLength(1);
    expect(view.diagnostics[0]).toEqual({ level: "info", message: "x" });
  });

  it("失败结果保留错误与诊断, output 为空", () => {
    const view = toResultView(
      fail("密钥过短", [{ level: "error", message: "需要 16 字节" }]),
      "hex",
    );
    expect(view.output).toBe("");
    expect(view.error).toBe("密钥过短");
    expect(view.diagnostics).toHaveLength(1);
  });
});
