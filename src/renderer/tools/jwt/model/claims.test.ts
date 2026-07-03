import { describe, expect, it } from "vitest";

import { buildClaims } from "./claims";

const NOW = 1_700_000_000_000; // 固定 now, 不依赖系统时钟

describe("buildClaims", () => {
  it("exp 在过去标记已过期", () => {
    const rows = buildClaims({ exp: 1_600_000_000 }, NOW);
    const exp = rows.find((r) => r.key === "exp");
    expect(exp?.status).toBe("expired");
    expect(exp?.note).toContain(":");
  });

  it("nbf 在未来标记未生效", () => {
    const rows = buildClaims({ nbf: 1_800_000_000 }, NOW);
    expect(rows.find((r) => r.key === "nbf")?.status).toBe("not-yet");
  });

  it("普通 claim 原样列出", () => {
    const rows = buildClaims({ iss: "acme", sub: "u1" }, NOW);
    expect(rows.find((r) => r.key === "iss")?.raw).toBe("acme");
  });
});
