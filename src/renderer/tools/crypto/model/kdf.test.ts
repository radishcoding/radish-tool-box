import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, utf8ToBytes } from "./codec";
import { computeKdf, kdfDefaults, type KdfRequest } from "./kdf";

/**
 * 构造 KDF 请求, 缺省取算法默认数值.
 */
function request(
  overrides: Partial<KdfRequest> & { algorithmId: string },
): KdfRequest {
  return {
    hashId: "sha256",
    password: utf8ToBytes(""),
    salt: utf8ToBytes(""),
    info: utf8ToBytes(""),
    ...kdfDefaults(overrides.algorithmId),
    ...overrides,
  };
}

describe("computeKdf RFC 标准向量", () => {
  it("PBKDF2-HMAC-SHA1 RFC6070 (c=1)", async () => {
    const outcome = await computeKdf(
      request({
        algorithmId: "pbkdf2",
        hashId: "sha1",
        password: utf8ToBytes("password"),
        salt: utf8ToBytes("salt"),
        iterations: 1,
        hashLength: 20,
      }),
    );
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    expect(bytesToHex(outcome.value)).toBe(
      "0c60c80f961f0e71f3a9b524af6012062fe037a6",
    );
  });

  it("HKDF RFC5869 Test Case 1 (SHA-256)", async () => {
    const outcome = await computeKdf(
      request({
        algorithmId: "hkdf",
        hashId: "sha256",
        password: new Uint8Array(22).fill(0x0b),
        salt: hexToBytes("000102030405060708090a0b0c"),
        info: hexToBytes("f0f1f2f3f4f5f6f7f8f9"),
        hashLength: 42,
      }),
    );
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    expect(bytesToHex(outcome.value)).toBe(
      "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
    );
  });

  it("scrypt RFC7914 (N=16,r=1,p=1)", async () => {
    const outcome = await computeKdf(
      request({
        algorithmId: "scrypt",
        cost: 16,
        blockSize: 1,
        parallelism: 1,
        hashLength: 64,
      }),
    );
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    expect(bytesToHex(outcome.value)).toBe(
      "77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906",
    );
  });
});

describe("computeKdf 功能断言", () => {
  it("Argon2id 输出长度正确且确定", async () => {
    const base = request({
      algorithmId: "argon2id",
      password: utf8ToBytes("pw"),
      salt: utf8ToBytes("saltsaltsaltsalt"),
      hashLength: 32,
    });
    const a = await computeKdf(base);
    const b = await computeKdf(base);
    if (!a.ok || !b.ok) {
      throw new Error("argon2id 计算失败");
    }
    expect(a.value.length).toBe(32);
    expect(bytesToHex(a.value)).toBe(bytesToHex(b.value));
  });

  it("Argon2i 输出长度正确且确定", async () => {
    const base = request({
      algorithmId: "argon2i",
      password: utf8ToBytes("pw"),
      salt: utf8ToBytes("saltsaltsaltsalt"),
      hashLength: 32,
    });
    const a = await computeKdf(base);
    const b = await computeKdf(base);
    if (!a.ok || !b.ok) {
      throw new Error("argon2i 计算失败");
    }
    expect(a.value.length).toBe(32);
    expect(bytesToHex(a.value)).toBe(bytesToHex(b.value));
  });

  it("Argon2d 输出长度正确且确定", async () => {
    const base = request({
      algorithmId: "argon2d",
      password: utf8ToBytes("pw"),
      salt: utf8ToBytes("saltsaltsaltsalt"),
      hashLength: 32,
    });
    const a = await computeKdf(base);
    const b = await computeKdf(base);
    if (!a.ok || !b.ok) {
      throw new Error("argon2d 计算失败");
    }
    expect(a.value.length).toBe(32);
    expect(bytesToHex(a.value)).toBe(bytesToHex(b.value));
  });

  it("Argon2i 与 Argon2d 相同输入输出不同 (变体互相独立)", async () => {
    const common = {
      password: utf8ToBytes("pw"),
      salt: utf8ToBytes("saltsaltsaltsalt"),
      hashLength: 32,
    };
    const ri = await computeKdf(request({ algorithmId: "argon2i", ...common }));
    const rd = await computeKdf(request({ algorithmId: "argon2d", ...common }));
    if (!ri.ok || !rd.ok) throw new Error("argon2 计算失败");
    // argon2i 与 argon2d 对同一输入产生不同摘要
    expect(bytesToHex(ri.value)).not.toBe(bytesToHex(rd.value));
  });

  it("bcrypt 输出为 $2 开头的 60 字符串", async () => {
    const outcome = await computeKdf(
      request({
        algorithmId: "bcrypt",
        password: utf8ToBytes("password"),
        salt: utf8ToBytes("0123456789abcdef"),
        cost: 10,
      }),
    );
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    const text = new TextDecoder().decode(outcome.value);
    expect(text.startsWith("$2")).toBe(true);
    expect(text).toHaveLength(60);
  });

  it("未知算法返回失败", async () => {
    const outcome = await computeKdf(request({ algorithmId: "nope" }));
    expect(outcome.ok).toBe(false);
  });
});
