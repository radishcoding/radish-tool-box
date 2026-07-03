import { beforeEach, describe, expect, it } from "vitest";

import { useCodecStore } from "./codec-store";

const initial = useCodecStore.getState();

beforeEach(() => {
  useCodecStore.setState(initial, true);
});

describe("codec store", () => {
  it("setOption 按 codec 命名空间合并", () => {
    useCodecStore.getState().setOption("base64", "variant", "url");
    expect(useCodecStore.getState().options.base64?.variant).toBe("url");
  });

  it("serialize 不含 result, hydrate 容忍非法输入", () => {
    useCodecStore.getState().setInput("abc");
    const snap = useCodecStore.getState().serialize();
    expect("result" in snap).toBe(false);
    useCodecStore.getState().hydrate(null);
    useCodecStore.getState().hydrate(7);
    expect(useCodecStore.getState().input).toBe("abc");
  });

  it("hydrate 合并持久化字段, input 与 options 正确落地", () => {
    useCodecStore.getState().hydrate({
      codecId: "hex",
      direction: "decode",
      charset: "gbk",
      hex: { upperCase: true, format: "space" },
      input: "41",
      options: { hex: { separator: ":" } },
    });
    const s = useCodecStore.getState();
    expect(s.codecId).toBe("hex");
    expect(s.direction).toBe("decode");
    expect(s.charset).toBe("gbk");
    expect(s.hex.format).toBe("space");
    expect(s.input).toBe("41");
    expect(s.options.hex?.separator).toBe(":");
  });

  it("setOption 对两个不同 codec 的选项互不干扰", () => {
    useCodecStore.getState().setOption("base64", "variant", "url");
    useCodecStore.getState().setOption("hex", "x", "y");
    const s = useCodecStore.getState();
    expect(s.options.base64?.variant).toBe("url");
    expect(s.options.hex?.x).toBe("y");
  });

  it("hydrate 只携带部分 codec 选项时不清空已有其它 codec 选项", () => {
    useCodecStore.getState().setOption("base64", "variant", "url");
    // hydrate 仅含 hex 选项, 不应覆盖 base64
    useCodecStore.getState().hydrate({ options: { hex: { separator: ":" } } });
    const s = useCodecStore.getState();
    expect(s.options.base64?.variant).toBe("url");
    expect(s.options.hex?.separator).toBe(":");
  });
});
