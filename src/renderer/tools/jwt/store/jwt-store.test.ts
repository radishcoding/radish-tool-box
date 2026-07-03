import { beforeEach, describe, expect, it } from "vitest";

import { useJwtStore } from "./jwt-store";

const initial = useJwtStore.getState();

beforeEach(() => {
  useJwtStore.setState(initial, true);
});

describe("jwt store", () => {
  it("serialize 不含密钥字段", () => {
    useJwtStore.getState().setToken("t");
    useJwtStore.getState().setVerifyKey("secret");
    useJwtStore.getState().setSignKey("priv");
    const snap = useJwtStore.getState().serialize();
    expect(snap.token).toBe("t");
    expect("verifyKey" in snap).toBe(false);
    expect("signKey" in snap).toBe(false);
  });

  it("hydrate 容忍非法输入并合并草稿", () => {
    useJwtStore.getState().hydrate(null);
    useJwtStore.getState().hydrate({
      tab: "sign",
      draft: { alg: "ES256", headerExtra: "", payload: "{}" },
    });
    const s = useJwtStore.getState();
    expect(s.tab).toBe("sign");
    expect(s.draft.alg).toBe("ES256");
  });
});
