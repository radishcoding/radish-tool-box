import { describe, expect, it } from "vitest";
import { p256, p384, p521 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";

import { bytesToHex, hexToBytes, utf8ToBytes } from "./codec";
import { generateAsymKeypair } from "./keypair";
import { runAsym } from "./asymmetric";
import type { AsymRequest } from "./asym-types";

/**
 * 构造非对称请求.
 */
function request(
  over: Partial<AsymRequest> & {
    algorithmId: string;
    operation: AsymRequest["operation"];
  },
): AsymRequest {
  return {
    variant: "",
    scheme: "",
    publicKey: "",
    privateKey: "",
    data: utf8ToBytes(""),
    signature: new Uint8Array(0),
    ...over,
  };
}

// ---------------------------------------------------------------------------
// ECDSA secp256k1 (已有, 保留)
// ---------------------------------------------------------------------------
describe("runAsym ECDSA secp256k1 签名验签往返", () => {
  it("生成 -> 签名 -> 验签为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "secp256k1");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("hello radish");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "secp256k1",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const verified = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "verify",
        variant: "secp256k1",
        publicKey: keys.value.publicKey,
        data,
        signature: signed.value.value,
      }),
    );
    if (!verified.ok || verified.value.kind !== "boolean")
      throw new Error("验签失败");
    expect(verified.value.value).toBe(true);
  });
});

describe("runAsym ECDSA secp256k1 已知约定 (标准 SHA-256 预哈希)", () => {
  it("工具签名可用 noble 显式 SHA-256 验证, 原始消息验证失败", async () => {
    const keys = await generateAsymKeypair("ecdsa", "secp256k1");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("standard ecdsa message");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "secp256k1",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const pubKeyBytes = hexToBytes(keys.value.publicKey);
    const digest = sha256(data);
    // 用显式 SHA-256(data) + prehash:false 验证 (等价于 prehash:true + 原始 data)
    expect(secp256k1.verify(signed.value.value, digest, pubKeyBytes)).toBe(
      true,
    );
    // 原始消息 (未哈希) 不应通过标准 ECDSA 验证
    expect(secp256k1.verify(signed.value.value, data, pubKeyBytes)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ECDSA P-256 / P-384 / P-521 往返 + 标准哈希交叉验证
// ---------------------------------------------------------------------------
describe("runAsym ECDSA P-256 往返 + SHA-256 交叉验证", () => {
  it("生成 -> 签名 -> 验签为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "p256");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("ecdsa p256 message");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "p256",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const verified = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "verify",
        variant: "p256",
        publicKey: keys.value.publicKey,
        data,
        signature: signed.value.value,
      }),
    );
    if (!verified.ok || verified.value.kind !== "boolean")
      throw new Error("验签失败");
    expect(verified.value.value).toBe(true);
  });

  it("P-256 工具签名经 noble P-256.verify(SHA-256 预哈希) 为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "p256");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("p256 cross verify");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "p256",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const pubBytes = hexToBytes(keys.value.publicKey);
    const digest = sha256(data);
    expect(p256.verify(signed.value.value, digest, pubBytes)).toBe(true);
  });
});

describe("runAsym ECDSA P-384 往返 + SHA-384 交叉验证", () => {
  it("生成 -> 签名 -> 验签为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "p384");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("ecdsa p384 message");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "p384",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const verified = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "verify",
        variant: "p384",
        publicKey: keys.value.publicKey,
        data,
        signature: signed.value.value,
      }),
    );
    if (!verified.ok || verified.value.kind !== "boolean")
      throw new Error("验签失败");
    expect(verified.value.value).toBe(true);
  });

  it("P-384 工具签名经 noble P-384.verify(SHA-384 预哈希) 为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "p384");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("p384 cross verify");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "p384",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const pubBytes = hexToBytes(keys.value.publicKey);
    const digest = sha384(data);
    expect(p384.verify(signed.value.value, digest, pubBytes)).toBe(true);
  });
});

describe("runAsym ECDSA P-521 往返 + SHA-512 交叉验证", () => {
  it("生成 -> 签名 -> 验签为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "p521");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("ecdsa p521 message");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "p521",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const verified = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "verify",
        variant: "p521",
        publicKey: keys.value.publicKey,
        data,
        signature: signed.value.value,
      }),
    );
    if (!verified.ok || verified.value.kind !== "boolean")
      throw new Error("验签失败");
    expect(verified.value.value).toBe(true);
  });

  it("P-521 工具签名经 noble P-521.verify(SHA-512 预哈希) 为真", async () => {
    const keys = await generateAsymKeypair("ecdsa", "p521");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("p521 cross verify");
    const signed = runAsym(
      request({
        algorithmId: "ecdsa",
        operation: "sign",
        variant: "p521",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const pubBytes = hexToBytes(keys.value.publicKey);
    const digest = sha512(data);
    expect(p521.verify(signed.value.value, digest, pubBytes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ed25519 (已有, 保留)
// ---------------------------------------------------------------------------
describe("runAsym Ed25519 往返", () => {
  it("生成 -> 签名 -> 验签为真", async () => {
    const keys = await generateAsymKeypair("ed25519", "");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("ed25519 message");
    const signed = runAsym(
      request({
        algorithmId: "ed25519",
        operation: "sign",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const verified = runAsym(
      request({
        algorithmId: "ed25519",
        operation: "verify",
        publicKey: keys.value.publicKey,
        data,
        signature: signed.value.value,
      }),
    );
    if (!verified.ok || verified.value.kind !== "boolean")
      throw new Error("验签失败");
    expect(verified.value.value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ECDH 协商一致
// ---------------------------------------------------------------------------
describe("runAsym ECDH 协商一致", () => {
  it("P-256 双方共享密钥相同 (已有)", async () => {
    const alice = await generateAsymKeypair("ecdh", "p256");
    const bob = await generateAsymKeypair("ecdh", "p256");
    if (!alice.ok || !bob.ok) throw new Error("生成失败");
    const sharedA = runAsym(
      request({
        algorithmId: "ecdh",
        operation: "derive",
        variant: "p256",
        privateKey: alice.value.privateKey,
        publicKey: bob.value.publicKey,
      }),
    );
    const sharedB = runAsym(
      request({
        algorithmId: "ecdh",
        operation: "derive",
        variant: "p256",
        privateKey: bob.value.privateKey,
        publicKey: alice.value.publicKey,
      }),
    );
    if (
      !sharedA.ok ||
      sharedA.value.kind !== "bytes" ||
      !sharedB.ok ||
      sharedB.value.kind !== "bytes"
    ) {
      throw new Error("协商失败");
    }
    expect(bytesToHex(sharedA.value.value)).toBe(
      bytesToHex(sharedB.value.value),
    );
  });

  it("P-384 双方共享密钥相同", async () => {
    const alice = await generateAsymKeypair("ecdh", "p384");
    const bob = await generateAsymKeypair("ecdh", "p384");
    if (!alice.ok || !bob.ok) throw new Error("生成失败");
    const sharedA = runAsym(
      request({
        algorithmId: "ecdh",
        operation: "derive",
        variant: "p384",
        privateKey: alice.value.privateKey,
        publicKey: bob.value.publicKey,
      }),
    );
    const sharedB = runAsym(
      request({
        algorithmId: "ecdh",
        operation: "derive",
        variant: "p384",
        privateKey: bob.value.privateKey,
        publicKey: alice.value.publicKey,
      }),
    );
    if (
      !sharedA.ok ||
      sharedA.value.kind !== "bytes" ||
      !sharedB.ok ||
      sharedB.value.kind !== "bytes"
    ) {
      throw new Error("协商失败");
    }
    expect(bytesToHex(sharedA.value.value)).toBe(
      bytesToHex(sharedB.value.value),
    );
  });

  it("secp256k1 双方共享密钥相同", async () => {
    const alice = await generateAsymKeypair("ecdh", "secp256k1");
    const bob = await generateAsymKeypair("ecdh", "secp256k1");
    if (!alice.ok || !bob.ok) throw new Error("生成失败");
    const sharedA = runAsym(
      request({
        algorithmId: "ecdh",
        operation: "derive",
        variant: "secp256k1",
        privateKey: alice.value.privateKey,
        publicKey: bob.value.publicKey,
      }),
    );
    const sharedB = runAsym(
      request({
        algorithmId: "ecdh",
        operation: "derive",
        variant: "secp256k1",
        privateKey: bob.value.privateKey,
        publicKey: alice.value.publicKey,
      }),
    );
    if (
      !sharedA.ok ||
      sharedA.value.kind !== "bytes" ||
      !sharedB.ok ||
      sharedB.value.kind !== "bytes"
    ) {
      throw new Error("协商失败");
    }
    expect(bytesToHex(sharedA.value.value)).toBe(
      bytesToHex(sharedB.value.value),
    );
  });
});

// ---------------------------------------------------------------------------
// X25519
// ---------------------------------------------------------------------------
describe("runAsym X25519 协商一致", () => {
  it("双方共享密钥相同", async () => {
    const alice = await generateAsymKeypair("x25519", "");
    const bob = await generateAsymKeypair("x25519", "");
    if (!alice.ok || !bob.ok) throw new Error("生成失败");
    const sharedA = runAsym(
      request({
        algorithmId: "x25519",
        operation: "derive",
        privateKey: alice.value.privateKey,
        publicKey: bob.value.publicKey,
      }),
    );
    const sharedB = runAsym(
      request({
        algorithmId: "x25519",
        operation: "derive",
        privateKey: bob.value.privateKey,
        publicKey: alice.value.publicKey,
      }),
    );
    if (
      !sharedA.ok ||
      sharedA.value.kind !== "bytes" ||
      !sharedB.ok ||
      sharedB.value.kind !== "bytes"
    ) {
      throw new Error("协商失败");
    }
    expect(bytesToHex(sharedA.value.value)).toBe(
      bytesToHex(sharedB.value.value),
    );
  });
});

// ---------------------------------------------------------------------------
// 国密 SM2
// ---------------------------------------------------------------------------
describe("runAsym 国密 SM2 往返", () => {
  it("生成 -> 加密 -> 解密还原 (已有)", async () => {
    const keys = await generateAsymKeypair("sm2", "");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("国密消息");
    const enc = runAsym(
      request({
        algorithmId: "sm2",
        operation: "encrypt",
        publicKey: keys.value.publicKey,
        data,
      }),
    );
    if (!enc.ok || enc.value.kind !== "bytes") throw new Error("加密失败");
    const dec = runAsym(
      request({
        algorithmId: "sm2",
        operation: "decrypt",
        privateKey: keys.value.privateKey,
        data: enc.value.value,
      }),
    );
    if (!dec.ok || dec.value.kind !== "bytes") throw new Error("解密失败");
    expect(bytesToHex(dec.value.value)).toBe(bytesToHex(data));
  });

  it("生成 -> 签名 -> 验签为真", async () => {
    const keys = await generateAsymKeypair("sm2", "");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("国密签名消息");
    const signed = runAsym(
      request({
        algorithmId: "sm2",
        operation: "sign",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!signed.ok || signed.value.kind !== "bytes")
      throw new Error("签名失败");
    const verified = runAsym(
      request({
        algorithmId: "sm2",
        operation: "verify",
        publicKey: keys.value.publicKey,
        data,
        signature: signed.value.value,
      }),
    );
    if (!verified.ok || verified.value.kind !== "boolean")
      throw new Error("验签失败");
    expect(verified.value.value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RSA (耗时)
// ---------------------------------------------------------------------------
describe("runAsym RSA 往返 (耗时)", () => {
  it("生成 2048 -> OAEP 加解密 + PSS 签验 (已有)", async () => {
    const keys = await generateAsymKeypair("rsa", "2048");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("rsa secret");
    const enc = runAsym(
      request({
        algorithmId: "rsa",
        operation: "encrypt",
        scheme: "oaep",
        publicKey: keys.value.publicKey,
        data,
      }),
    );
    if (!enc.ok || enc.value.kind !== "bytes") throw new Error("加密失败");
    const dec = runAsym(
      request({
        algorithmId: "rsa",
        operation: "decrypt",
        scheme: "oaep",
        privateKey: keys.value.privateKey,
        data: enc.value.value,
      }),
    );
    if (!dec.ok || dec.value.kind !== "bytes") throw new Error("解密失败");
    expect(bytesToHex(dec.value.value)).toBe(bytesToHex(data));

    const sig = runAsym(
      request({
        algorithmId: "rsa",
        operation: "sign",
        scheme: "pss",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!sig.ok || sig.value.kind !== "bytes") throw new Error("签名失败");
    const ver = runAsym(
      request({
        algorithmId: "rsa",
        operation: "verify",
        scheme: "pss",
        publicKey: keys.value.publicKey,
        data,
        signature: sig.value.value,
      }),
    );
    if (!ver.ok || ver.value.kind !== "boolean") throw new Error("验签失败");
    expect(ver.value.value).toBe(true);
  });

  it("生成 2048 -> PKCS1v1.5 加解密往返", async () => {
    const keys = await generateAsymKeypair("rsa", "2048");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("rsa pkcs1 secret");
    const enc = runAsym(
      request({
        algorithmId: "rsa",
        operation: "encrypt",
        scheme: "pkcs1",
        publicKey: keys.value.publicKey,
        data,
      }),
    );
    if (!enc.ok || enc.value.kind !== "bytes")
      throw new Error("PKCS1 加密失败");
    const dec = runAsym(
      request({
        algorithmId: "rsa",
        operation: "decrypt",
        scheme: "pkcs1",
        privateKey: keys.value.privateKey,
        data: enc.value.value,
      }),
    );
    if (!dec.ok || dec.value.kind !== "bytes")
      throw new Error("PKCS1 解密失败");
    expect(bytesToHex(dec.value.value)).toBe(bytesToHex(data));
  });

  it("生成 2048 -> PKCS1v1.5 签名验签往返", async () => {
    const keys = await generateAsymKeypair("rsa", "2048");
    if (!keys.ok) throw new Error(keys.error);
    const data = utf8ToBytes("rsa pkcs1 sign message");
    const sig = runAsym(
      request({
        algorithmId: "rsa",
        operation: "sign",
        scheme: "pkcs1-sign",
        privateKey: keys.value.privateKey,
        data,
      }),
    );
    if (!sig.ok || sig.value.kind !== "bytes")
      throw new Error("PKCS1-sign 签名失败");
    const ver = runAsym(
      request({
        algorithmId: "rsa",
        operation: "verify",
        scheme: "pkcs1-sign",
        publicKey: keys.value.publicKey,
        data,
        signature: sig.value.value,
      }),
    );
    if (!ver.ok || ver.value.kind !== "boolean")
      throw new Error("PKCS1-sign 验签失败");
    expect(ver.value.value).toBe(true);
  });
});
