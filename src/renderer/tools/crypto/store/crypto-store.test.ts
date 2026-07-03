import { describe, expect, it } from "vitest";

import { useCryptoStore } from "./crypto-store";

describe("crypto-store 序列化往返", () => {
  it("serialize 反映当前状态, running 不持久化为 true", () => {
    useCryptoStore.getState().updateHash({ algorithmId: "sm3" });
    useCryptoStore.getState().updateKdf({ running: true });
    const snapshot = useCryptoStore.getState().serialize();
    expect(snapshot.hash.algorithmId).toBe("sm3");
    expect(snapshot.kdf.running).toBe(false);
  });

  it("hydrate 合并持久状态", () => {
    useCryptoStore.getState().hydrate({
      activeCategory: "symmetric",
      symmetric: { algorithmId: "sm4" },
    });
    expect(useCryptoStore.getState().activeCategory).toBe("symmetric");
    expect(useCryptoStore.getState().symmetric.algorithmId).toBe("sm4");
  });

  it("hydrate 忽略非对象输入", () => {
    const before = useCryptoStore.getState().activeCategory;
    useCryptoStore.getState().hydrate(undefined);
    expect(useCryptoStore.getState().activeCategory).toBe(before);
  });

  it("hydrate 强制复位 asym/kdf 的 running 为 false", () => {
    useCryptoStore
      .getState()
      .hydrate({ asym: { running: true }, kdf: { running: true } });
    expect(useCryptoStore.getState().asym.running).toBe(false);
    expect(useCryptoStore.getState().kdf.running).toBe(false);
  });

  it("hydrate 含缺子字段的脏切片后, EncodedBytes 子字段回退默认而非 undefined", () => {
    // 模拟持久化数据中 hash.input 缺少 encoding 字段
    useCryptoStore.getState().hydrate({
      hash: { algorithmId: "md5", input: { text: "dirty" } },
      hmac: { hashId: "sha512", key: { text: "k" } },
      symmetric: { algorithmId: "sm4", key: { text: "0".repeat(32) } },
      kdf: { algorithmId: "scrypt", password: { text: "pw" } },
      asym: { algorithmId: "ecdsa", input: { text: "msg" } },
    });
    // hash.input.encoding 应回退初始值 "utf8", 而非 undefined
    expect(useCryptoStore.getState().hash.input.encoding).toBe("utf8");
    expect(useCryptoStore.getState().hash.input.text).toBe("dirty");
    // hmac.key.encoding 应回退初始值 "utf8"
    expect(useCryptoStore.getState().hmac.key.encoding).toBe("utf8");
    // hmac.input 完全缺失时也回退默认
    expect(useCryptoStore.getState().hmac.input.encoding).toBe("utf8");
    // symmetric.key.encoding 应回退初始值 "hex"
    expect(useCryptoStore.getState().symmetric.key.encoding).toBe("hex");
    // kdf.password.encoding 回退默认
    expect(useCryptoStore.getState().kdf.password.encoding).toBe("utf8");
    // asym.input.encoding 回退默认
    expect(useCryptoStore.getState().asym.input.encoding).toBe("utf8");
    // asym.signature 完全缺失时回退默认
    expect(useCryptoStore.getState().asym.signature.encoding).toBe("hex");
  });
});
