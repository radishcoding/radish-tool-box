import { beforeEach, describe, expect, it } from "vitest";

import { useEncodingStore } from "./encoding-store";

const initial = useEncodingStore.getState();

beforeEach(() => {
  useEncodingStore.setState(initial, true);
});

describe("encoding store", () => {
  it("swap 对调源与目标的形态/字符集/内容", () => {
    const s = useEncodingStore.getState();
    s.updateSource({ form: "hex", charset: "gbk", text: "d6d0" });
    s.setTargetForm("text");
    s.setTargetCharset("utf-8");
    s.setResult({ output: "中", error: "", diagnostics: [] });
    useEncodingStore.getState().swap();
    const after = useEncodingStore.getState();
    expect(after.source.form).toBe("text");
    expect(after.source.charset).toBe("utf-8");
    expect(after.source.text).toBe("中");
    expect(after.targetForm).toBe("hex");
    expect(after.targetCharset).toBe("gbk");
  });

  it("serialize 不含结果, hydrate 容忍非法输入", () => {
    useEncodingStore.getState().setStrict(true);
    const snapshot = useEncodingStore.getState().serialize();
    expect(snapshot.strict).toBe(true);
    expect("result" in snapshot).toBe(false);
    useEncodingStore.getState().hydrate(null);
    useEncodingStore.getState().hydrate(42);
    expect(useEncodingStore.getState().strict).toBe(true);
  });

  it("hydrate 合并持久化字段 + 新 format", () => {
    useEncodingStore.getState().hydrate({
      source: { form: "base64", charset: "big5", text: "abc" },
      targetForm: "hex",
      targetCharset: "gb18030",
      strict: true,
      hex: { upperCase: true, format: "array-hex" },
    });
    const s = useEncodingStore.getState();
    expect(s.source.form).toBe("base64");
    expect(s.targetCharset).toBe("gb18030");
    expect(s.hex.upperCase).toBe(true);
    expect(s.hex.format).toBe("array-hex");
  });

  it("hydrate 兼容旧版 separator 字段, 迁移为 format", () => {
    useEncodingStore
      .getState()
      .hydrate({ hex: { upperCase: false, separator: "-" } });
    expect(useEncodingStore.getState().hex.format).toBe("dash");
  });
});
