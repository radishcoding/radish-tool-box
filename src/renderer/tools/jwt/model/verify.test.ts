import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { verifyToken } from "./verify";

const SECRET = "my-secret-key";

/**
 * 用 HS256 现签一个 token 供测试.
 */
async function makeHs256(): Promise<string> {
  const key = new TextEncoder().encode(SECRET);
  return new SignJWT({ sub: "u1" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(key);
}

describe("verifyToken", () => {
  it("HS256 正确密钥验签通过", async () => {
    const token = await makeHs256();
    const r = await verifyToken(token, SECRET, "HS256");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.valid).toBe(true);
    }
  });

  it("HS256 错误密钥验签不通过", async () => {
    const token = await makeHs256();
    const r = await verifyToken(token, "wrong", "HS256");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.valid).toBe(false);
    }
  });

  it("缺密钥返回失败", async () => {
    const token = await makeHs256();
    expect((await verifyToken(token, "", "HS256")).ok).toBe(false);
  });

  it("ES256 正确密钥对验签通过", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const publicKeyPem = await exportSPKI(publicKey);
    const token = await new SignJWT({ sub: "u2" })
      .setProtectedHeader({ alg: "ES256" })
      .sign(privateKey);
    const r = await verifyToken(token, publicKeyPem, "ES256");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.valid).toBe(true);
    }
  });

  it("ES256 错误公钥验签不通过", async () => {
    const { privateKey } = await generateKeyPair("ES256");
    const { publicKey: wrongPublicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const wrongPublicKeyPem = await exportSPKI(wrongPublicKey);
    const token = await new SignJWT({ sub: "u3" })
      .setProtectedHeader({ alg: "ES256" })
      .sign(privateKey);
    const r = await verifyToken(token, wrongPublicKeyPem, "ES256");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.valid).toBe(false);
    }
  });
});
