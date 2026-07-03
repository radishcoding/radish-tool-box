import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, utf8ToBytes } from "./codec";
import { HMAC_HASHES, computeHmac } from "./hmac";

/**
 * 用 Node.js createHmac 作为 oracle 计算 HMAC 十六进制.
 * @param nodeAlgo Node.js 哈希算法名.
 * @param keyHex 密钥十六进制.
 * @param message 消息字符串.
 */
function nodeHmacHex(
  nodeAlgo: string,
  keyHex: string,
  message: string,
): string {
  return createHmac(nodeAlgo, Buffer.from(keyHex, "hex"))
    .update(message)
    .digest("hex");
}

/**
 * RFC 4231 测试向量通用密钥: 20 字节 0x0b (SHA-1/SHA-2 系列).
 */
const RFC_KEY_20_HEX = "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b";

/**
 * RFC 2202 Test Case 1 MD5 密钥: 16 字节 0x0b.
 */
const RFC_KEY_MD5_HEX = "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b";

const RFC_MSG = "Hi There";

describe("computeHmac 标准向量", () => {
  it("HMAC-SHA256 fox (原有向量)", async () => {
    const outcome = await computeHmac(
      "sha256",
      utf8ToBytes("key"),
      utf8ToBytes("The quick brown fox jumps over the lazy dog"),
    );
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    expect(bytesToHex(outcome.value)).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });

  // RFC 2202 Test Case 1: HMAC-MD5 (密钥 16 字节)
  it("HMAC-MD5 RFC2202 (oracle)", async () => {
    const expected = nodeHmacHex("md5", RFC_KEY_MD5_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "md5",
      hexToBytes(RFC_KEY_MD5_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("9294727a3638bb1c13f48ef8158bfc9d");
  });

  // RFC 2202 Test Case 1: HMAC-SHA1 (密钥 20 字节)
  it("HMAC-SHA1 RFC2202 (oracle)", async () => {
    const expected = nodeHmacHex("sha1", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "sha1",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("b617318655057264e28bc0b6fb378c8ef146be00");
  });

  // RFC 4231 Test Case 1: HMAC-SHA512 (密钥 20 字节)
  it("HMAC-SHA512 RFC4231 (oracle)", async () => {
    const expected = nodeHmacHex("sha512", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "sha512",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe(
      "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854",
    );
  });

  // RFC 4231 Test Case 1: HMAC-SHA384 (密钥 20 字节)
  it("HMAC-SHA384 RFC4231 (oracle)", async () => {
    const expected = nodeHmacHex("sha384", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "sha384",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe(
      "afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6",
    );
  });

  // HMAC-SHA3-256 (oracle, 密钥 20 字节)
  it("HMAC-SHA3-256 (oracle)", async () => {
    const expected = nodeHmacHex("sha3-256", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "sha3-256",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe(
      "ba85192310dffa96e2a3a40e69774351140bb7185e1202cdcc917589f95e16bb",
    );
  });

  // HMAC-SHA3-512 (oracle, 密钥 20 字节)
  it("HMAC-SHA3-512 (oracle)", async () => {
    const expected = nodeHmacHex("sha3-512", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "sha3-512",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe(
      "eb3fbd4b2eaab8f5c504bd3a41465aacec15770a7cabac531e482f860b5ec7ba47ccb2c6f2afce8f88d22b6dc61380f23a668fd3888bb80537c0a0b86407689e",
    );
  });

  // HMAC-RIPEMD160 (oracle, 密钥 20 字节)
  it("HMAC-RIPEMD160 (oracle)", async () => {
    const expected = nodeHmacHex("ripemd160", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "ripemd160",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe("24cb4bd67d20fc1a5d2ed7732dcc39377f0a5668");
  });

  // HMAC-SM3 (oracle, 密钥 20 字节): Node 支持 sm3
  it("HMAC-SM3 (oracle)", async () => {
    const expected = nodeHmacHex("sm3", RFC_KEY_20_HEX, RFC_MSG);
    const outcome = await computeHmac(
      "sm3",
      hexToBytes(RFC_KEY_20_HEX),
      utf8ToBytes(RFC_MSG),
    );
    if (!outcome.ok) throw new Error(outcome.error);
    expect(bytesToHex(outcome.value)).toBe(expected);
    expect(expected).toBe(
      "51b00d1fb49832bfb01c3ce27848e59f871d9ba938dc563b338ca964755cce70",
    );
  });

  it("未知哈希返回失败", async () => {
    const outcome = await computeHmac(
      "nope",
      utf8ToBytes("k"),
      utf8ToBytes("m"),
    );
    expect(outcome.ok).toBe(false);
  });
});

describe("HMAC_HASHES", () => {
  it("含 sha256 与 sm3", () => {
    const ids = HMAC_HASHES.map((item) => item.id);
    expect(ids).toContain("sha256");
    expect(ids).toContain("sm3");
  });

  it("表内每个哈希均能成功计算 (全覆盖健康检查)", async () => {
    for (const hash of HMAC_HASHES) {
      const outcome = await computeHmac(
        hash.id,
        utf8ToBytes("key"),
        utf8ToBytes("message"),
      );
      expect(outcome.ok, `HMAC-${hash.id} 应成功`).toBe(true);
    }
  });
});
