import { describe, expect, it } from "vitest";

import { signToken } from "./sign";
import { verifyToken } from "./verify";

describe("signToken", () => {
  it("HS256 签发后可被验签通过 (往返)", async () => {
    const r = await signToken(
      { alg: "HS256", headerExtra: "", payload: '{"sub":"u1"}' },
      "secret",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = await verifyToken(r.value, "secret", "HS256");
      expect(v.ok && v.value.valid).toBe(true);
    }
  });

  it("payload 非法 JSON 返回失败", async () => {
    const r = await signToken(
      { alg: "HS256", headerExtra: "", payload: "{bad" },
      "secret",
    );
    expect(r.ok).toBe(false);
  });
});
