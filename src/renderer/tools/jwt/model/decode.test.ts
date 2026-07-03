import { describe, expect, it } from "vitest";

import { decodeToken } from "./decode";

// 固定样例: {alg:HS256}.{sub:"1234",name:"Tom",iat:1700000000}.sig
const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiIxMjM0IiwibmFtZSI6IlRvbSIsImlhdCI6MTcwMDAwMDAwMH0" +
  ".KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30";

describe("decodeToken", () => {
  it("解出三段", () => {
    const r = decodeToken(SAMPLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.header.alg).toBe("HS256");
      expect(r.value.payload.sub).toBe("1234");
      expect(r.value.signature.length).toBeGreaterThan(0);
    }
  });

  it("段数不为 3 报错", () => {
    expect(decodeToken("a.b").ok).toBe(false);
  });

  it("非法 base64url 报错", () => {
    expect(decodeToken("@@@.###.$$$").ok).toBe(false);
  });
});
