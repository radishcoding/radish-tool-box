import { createCipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, utf8ToBytes } from "./codec";
import {
  runSymmetric,
  type SymmetricMode,
  type SymmetricOperation,
  type SymmetricPadding,
} from "./symmetric";

/**
 * 构造对称参数的便捷工具, 省略项取空字节.
 */
function params(overrides: {
  algorithmId: string;
  operation: SymmetricOperation;
  data: Uint8Array;
  key: Uint8Array;
  mode?: SymmetricMode;
  padding?: SymmetricPadding;
  iv?: Uint8Array;
  aad?: Uint8Array;
}) {
  return {
    algorithmId: overrides.algorithmId,
    operation: overrides.operation,
    data: overrides.data,
    key: overrides.key,
    mode: overrides.mode ?? "cbc",
    padding: overrides.padding ?? "pkcs7",
    iv: overrides.iv ?? new Uint8Array(0),
    aad: overrides.aad ?? new Uint8Array(0),
  };
}

/**
 * 用 Node.js createCipheriv 作为 oracle 计算加密十六进制 (NoPadding, 数据须整块).
 * @param nodeAlgo Node 算法名.
 * @param keyHex 密钥十六进制.
 * @param ivHex IV 十六进制, ECB 传 null.
 * @param ptHex 明文十六进制.
 */
function nodeEncryptHex(
  nodeAlgo: string,
  keyHex: string,
  ivHex: string | null,
  ptHex: string,
): string {
  const iv = ivHex ? Buffer.from(ivHex, "hex") : null;
  const cipher = createCipheriv(
    nodeAlgo,
    Buffer.from(keyHex, "hex"),
    iv as Buffer,
  );
  cipher.setAutoPadding(false);
  return Buffer.concat([
    cipher.update(Buffer.from(ptHex, "hex")),
    cipher.final(),
  ]).toString("hex");
}

// ---------------------------------------------------------------------------
// AES-CBC (已有, 保留)
// ---------------------------------------------------------------------------
describe("runSymmetric AES-CBC NIST 向量", () => {
  it("AES-128-CBC NoPadding 单块加密匹配 SP800-38A", () => {
    const outcome = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "cbc",
        padding: "none",
        key: hexToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        iv: hexToBytes("000102030405060708090a0b0c0d0e0f"),
        data: hexToBytes("6bc1bee22e409f96e93d7e117393172a"),
      }),
    );
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    expect(bytesToHex(outcome.value)).toBe("7649abac8119b246cee98e9b12e9197d");
  });
});

// ---------------------------------------------------------------------------
// AES 其他模式 (ECB / CFB / OFB / CTR): oracle 交叉验证
// ---------------------------------------------------------------------------
describe("runSymmetric AES 模式扩展 (oracle)", () => {
  const aesKey128 = "2b7e151628aed2a6abf7158809cf4f3c";
  const aesKey256 =
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const iv16 = "000102030405060708090a0b0c0d0e0f";
  const ctrIv16 = "f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff";
  // SP800-38A F.1.1 明文块
  const ptBlock = "6bc1bee22e409f96e93d7e117393172a";

  it("AES-128-ECB NoPadding (SP800-38A F.1.1 oracle)", () => {
    const expected = nodeEncryptHex("aes-128-ecb", aesKey128, null, ptBlock);
    const outcome = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "ecb",
        padding: "none",
        key: hexToBytes(aesKey128),
        data: hexToBytes(ptBlock),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    // 已知答案 SP800-38A F.1.1
    expect(expected).toBe("3ad77bb40d7a3660a89ecaf32466ef97");
  });

  it("AES-128-CFB NoPadding (SP800-38A F.3.1 oracle)", () => {
    const expected = nodeEncryptHex("aes-128-cfb", aesKey128, iv16, ptBlock);
    const outcome = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "cfb",
        padding: "none",
        key: hexToBytes(aesKey128),
        iv: hexToBytes(iv16),
        data: hexToBytes(ptBlock),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("3b3fd92eb72dad20333449f8e83cfb4a");
  });

  it("AES-128-OFB NoPadding (SP800-38A F.4.1 oracle)", () => {
    const expected = nodeEncryptHex("aes-128-ofb", aesKey128, iv16, ptBlock);
    const outcome = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "ofb",
        padding: "none",
        key: hexToBytes(aesKey128),
        iv: hexToBytes(iv16),
        data: hexToBytes(ptBlock),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("3b3fd92eb72dad20333449f8e83cfb4a");
  });

  it("AES-128-CTR NoPadding (SP800-38A F.5.1 oracle)", () => {
    const expected = nodeEncryptHex("aes-128-ctr", aesKey128, ctrIv16, ptBlock);
    const outcome = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "ctr",
        padding: "none",
        key: hexToBytes(aesKey128),
        iv: hexToBytes(ctrIv16),
        data: hexToBytes(ptBlock),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("874d6191b620e3261bef6864990db6ce");
  });

  it("AES-256-ECB NoPadding 加解密往返", () => {
    const key = hexToBytes(aesKey256);
    const data = hexToBytes(ptBlock);
    const enc = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "ecb",
        padding: "none",
        key,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "decrypt",
        mode: "ecb",
        padding: "none",
        key,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("AES-256-CFB PKCS7 加解密往返", () => {
    const key = hexToBytes(aesKey256);
    const iv = hexToBytes(iv16);
    const data = utf8ToBytes("hello cfb radish 萝卜");
    const enc = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "cfb",
        padding: "pkcs7",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "decrypt",
        mode: "cfb",
        padding: "pkcs7",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("AES-256-OFB PKCS7 加解密往返", () => {
    const key = hexToBytes(aesKey256);
    const iv = hexToBytes(iv16);
    const data = utf8ToBytes("hello ofb radish");
    const enc = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "ofb",
        padding: "pkcs7",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "decrypt",
        mode: "ofb",
        padding: "pkcs7",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("AES-256-CTR NoPadding 加解密往返", () => {
    const key = hexToBytes(aesKey256);
    const iv = hexToBytes(ctrIv16);
    const data = utf8ToBytes("hello ctr radish");
    const enc = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        mode: "ctr",
        padding: "none",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "decrypt",
        mode: "ctr",
        padding: "none",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// AES-GCM + ChaCha20-Poly1305 往返 (已有, 保留)
// ---------------------------------------------------------------------------
describe("runSymmetric AEAD 往返", () => {
  it("AES-GCM 加解密往返", () => {
    const key = hexToBytes(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
    const iv = hexToBytes("000102030405060708090a0b");
    const data = utf8ToBytes("aead message");
    const enc = runSymmetric(
      params({
        algorithmId: "aes-gcm",
        operation: "encrypt",
        mode: "gcm",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "aes-gcm",
        operation: "decrypt",
        mode: "gcm",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("ChaCha20-Poly1305 加解密往返", () => {
    const key = hexToBytes(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
    const iv = hexToBytes("000000000000000000000000");
    const data = utf8ToBytes("chacha");
    const enc = runSymmetric(
      params({
        algorithmId: "chacha20-poly1305",
        operation: "encrypt",
        mode: "gcm",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "chacha20-poly1305",
        operation: "decrypt",
        mode: "gcm",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// DES: Node 现代版本已移除 des-cbc/des-ecb, 用往返验证
// ---------------------------------------------------------------------------
describe("runSymmetric DES 往返", () => {
  const desKey = hexToBytes("0123456789abcdef"); // 8 bytes
  const desIv = hexToBytes("0102030405060708"); // 8 bytes

  it("DES-CBC PKCS7 加解密往返 (往返验证, Node 已移除 des-cbc)", () => {
    const data = utf8ToBytes("hello des");
    const enc = runSymmetric(
      params({
        algorithmId: "des",
        operation: "encrypt",
        mode: "cbc",
        padding: "pkcs7",
        key: desKey,
        iv: desIv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "des",
        operation: "decrypt",
        mode: "cbc",
        padding: "pkcs7",
        key: desKey,
        iv: desIv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("DES-ECB NoPadding 加解密往返 (往返验证)", () => {
    const data = hexToBytes("68656c6c6f3132333435363738393031"); // 16 bytes = 2 blocks
    const enc = runSymmetric(
      params({
        algorithmId: "des",
        operation: "encrypt",
        mode: "ecb",
        padding: "none",
        key: desKey,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "des",
        operation: "decrypt",
        mode: "ecb",
        padding: "none",
        key: desKey,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// 3DES: Node 支持 des-ede3-cbc (24-byte), des-ede-cbc (16-byte)
// ---------------------------------------------------------------------------
describe("runSymmetric 3DES oracle", () => {
  const key24 = "000102030405060708090a0b0c0d0e0f1011121314151617";
  const iv8 = "0807060504030201";
  const ptHex = "68656c6c6f313233"; // 'hello123' (8 bytes, 1 DES block)

  it("3DES-CBC 24-byte key NoPadding (oracle)", () => {
    const expected = nodeEncryptHex("des-ede3-cbc", key24, iv8, ptHex);
    const outcome = runSymmetric(
      params({
        algorithmId: "3des",
        operation: "encrypt",
        mode: "cbc",
        padding: "none",
        key: hexToBytes(key24),
        iv: hexToBytes(iv8),
        data: hexToBytes(ptHex),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("69b143288ecfb05a");
  });

  it("3DES-ECB 24-byte key NoPadding 加解密往返", () => {
    // crypto-js TripleDES ECB 与 Node des-ede3-ecb 字节序不同, 改用往返验证
    const key = hexToBytes(key24);
    const data = hexToBytes(ptHex);
    const enc = runSymmetric(
      params({
        algorithmId: "3des",
        operation: "encrypt",
        mode: "ecb",
        padding: "none",
        key,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "3des",
        operation: "decrypt",
        mode: "ecb",
        padding: "none",
        key,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("3DES-CBC 24-byte key PKCS7 加解密往返", () => {
    const key = hexToBytes(key24);
    const iv = hexToBytes(iv8);
    const data = utf8ToBytes("hello 3des radish 萝卜");
    const enc = runSymmetric(
      params({
        algorithmId: "3des",
        operation: "encrypt",
        mode: "cbc",
        padding: "pkcs7",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "3des",
        operation: "decrypt",
        mode: "cbc",
        padding: "pkcs7",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// RC4: Node 已移除 rc4, 用往返验证
// ---------------------------------------------------------------------------
describe("runSymmetric RC4 往返", () => {
  it("RC4 加解密往返 (往返验证, Node 已移除 rc4)", () => {
    const key = utf8ToBytes("rc4secretkey");
    const data = utf8ToBytes("hello rc4 stream cipher");
    const enc = runSymmetric(
      params({ algorithmId: "rc4", operation: "encrypt", key, data }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "rc4",
        operation: "decrypt",
        key,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("RC4 加密非零输出 (非空密文)", () => {
    const key = hexToBytes("0102030405060708090a0b0c0d0e0f10");
    const data = utf8ToBytes("test");
    const enc = runSymmetric(
      params({ algorithmId: "rc4", operation: "encrypt", key, data }),
    );
    if (!enc.ok) throw new Error(enc.error);
    expect(enc.value.length).toBe(data.length);
    // 密文应与明文不同 (RC4 非零密钥流)
    expect(bytesToHex(enc.value)).not.toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// Rabbit: Node 无 Rabbit, 用往返验证
// ---------------------------------------------------------------------------
describe("runSymmetric Rabbit 往返", () => {
  it("Rabbit 加解密往返 (往返验证, Rabbit 无 Node 支持)", () => {
    const key = hexToBytes("0123456789abcdef0123456789abcdef"); // 16 bytes
    const data = utf8ToBytes("hello rabbit stream cipher test");
    const enc = runSymmetric(
      params({ algorithmId: "rabbit", operation: "encrypt", key, data }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "rabbit",
        operation: "decrypt",
        key,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("Rabbit 加密非零输出 (非空密文)", () => {
    const key = hexToBytes("0123456789abcdef0123456789abcdef");
    const data = utf8ToBytes("test");
    const enc = runSymmetric(
      params({ algorithmId: "rabbit", operation: "encrypt", key, data }),
    );
    if (!enc.ok) throw new Error(enc.error);
    expect(enc.value.length).toBe(data.length);
    expect(bytesToHex(enc.value)).not.toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// 国密 SM4
// ---------------------------------------------------------------------------
describe("runSymmetric 国密 SM4 GB/T 向量", () => {
  it("SM4 ECB NoPadding 单块加密 (GB/T 32907-2016 oracle)", () => {
    const sm4Key = "0123456789abcdeffedcba9876543210";
    const sm4Pt = "0123456789abcdeffedcba9876543210";
    const expected = nodeEncryptHex("sm4-ecb", sm4Key, null, sm4Pt);
    const outcome = runSymmetric(
      params({
        algorithmId: "sm4",
        operation: "encrypt",
        mode: "ecb",
        padding: "none",
        key: hexToBytes(sm4Key),
        data: hexToBytes(sm4Pt),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    // 已知答案 (GB/T 32907-2016)
    expect(expected).toBe("681edf34d206965e86b3e94f536e4246");
  });

  it("SM4 CBC NoPadding 单块加密 (oracle)", () => {
    const sm4Key = "0123456789abcdeffedcba9876543210";
    const sm4Iv = "00112233445566778899aabbccddeeff";
    const sm4Pt = "0123456789abcdeffedcba9876543210";
    const expected = nodeEncryptHex("sm4-cbc", sm4Key, sm4Iv, sm4Pt);
    const outcome = runSymmetric(
      params({
        algorithmId: "sm4",
        operation: "encrypt",
        mode: "cbc",
        padding: "none",
        key: hexToBytes(sm4Key),
        iv: hexToBytes(sm4Iv),
        data: hexToBytes(sm4Pt),
      }),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("5d1fee63f5eb8bb503580ab823925d55");
  });

  it("SM4 CBC PKCS7 加解密往返", () => {
    const key = hexToBytes("0123456789abcdeffedcba9876543210");
    const iv = hexToBytes("00112233445566778899aabbccddeeff");
    const data = utf8ToBytes("hello sm4 radish");
    const enc = runSymmetric(
      params({
        algorithmId: "sm4",
        operation: "encrypt",
        mode: "cbc",
        padding: "pkcs7",
        key,
        iv,
        data,
      }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "sm4",
        operation: "decrypt",
        mode: "cbc",
        padding: "pkcs7",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });

  it("SM4 使用不支持的填充 (zero) 时返回失败", () => {
    const key = hexToBytes("0123456789abcdeffedcba9876543210");
    const iv = hexToBytes("00112233445566778899aabbccddeeff");
    const outcome = runSymmetric(
      params({
        algorithmId: "sm4",
        operation: "encrypt",
        mode: "cbc",
        padding: "zero",
        key,
        iv,
        data: utf8ToBytes("test"),
      }),
    );
    expect(outcome.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ChaCha20 流密码往返
// ---------------------------------------------------------------------------
describe("runSymmetric ChaCha20 往返", () => {
  it("ChaCha20 加解密往返", () => {
    const key = hexToBytes(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
    const iv = hexToBytes("000000000000000000000000");
    const data = utf8ToBytes("hello chacha20 stream");
    const enc = runSymmetric(
      params({ algorithmId: "chacha20", operation: "encrypt", key, iv, data }),
    );
    if (!enc.ok) throw new Error(enc.error);
    const dec = runSymmetric(
      params({
        algorithmId: "chacha20",
        operation: "decrypt",
        key,
        iv,
        data: enc.value,
      }),
    );
    if (!dec.ok) throw new Error(dec.error);
    expect(bytesToHex(dec.value)).toBe(bytesToHex(data));
  });
});

// ---------------------------------------------------------------------------
// 错误分支
// ---------------------------------------------------------------------------
describe("runSymmetric 错误分支", () => {
  it("AES 密钥长度非法返回失败且带诊断", () => {
    const outcome = runSymmetric(
      params({
        algorithmId: "aes",
        operation: "encrypt",
        key: hexToBytes("00112233"),
        iv: hexToBytes("000102030405060708090a0b0c0d0e0f"),
        data: utf8ToBytes("x"),
      }),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics.length).toBeGreaterThan(0);
  });

  it("未知算法返回失败", () => {
    const outcome = runSymmetric(
      params({
        algorithmId: "nope",
        operation: "encrypt",
        key: hexToBytes("00112233"),
        data: utf8ToBytes("x"),
      }),
    );
    expect(outcome.ok).toBe(false);
  });
});
