import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { bytesToHex, utf8ToBytes } from "./codec";
import { HASH_ALGORITHMS, computeHash } from "./hash";

/**
 * 计算指定算法对 UTF-8 文本的摘要十六进制.
 */
async function digestHex(id: string, text: string): Promise<string> {
  const outcome = await computeHash(id, utf8ToBytes(text));
  if (!outcome.ok) {
    throw new Error(outcome.error);
  }
  return bytesToHex(outcome.value);
}

/**
 * 用 Node.js createHash 计算哈希作为 oracle, 与工具输出交叉验证.
 */
function nodeHashHex(algo: string, text: string): string {
  return createHash(algo).update(text).digest("hex");
}

describe("computeHash 标准向量", () => {
  it("MD5 空串", async () => {
    expect(await digestHex("md5", "")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("SHA-256 abc", async () => {
    expect(await digestHex("sha256", "abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("SHA3-256 abc", async () => {
    expect(await digestHex("sha3-256", "abc")).toBe(
      "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
    );
  });

  it("国密 SM3 abc", async () => {
    expect(await digestHex("sm3", "abc")).toBe(
      "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0",
    );
  });

  it("CRC32 123456789", async () => {
    expect(await digestHex("crc32", "123456789")).toBe("cbf43926");
  });

  // Node oracle 交叉验证
  it("SHA-1 abc (oracle)", async () => {
    const expected = nodeHashHex("sha1", "abc");
    expect(await digestHex("sha1", "abc")).toBe(expected);
    // 同时验证已知答案 (FIPS 180-4)
    expect(expected).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it("SHA-224 abc (oracle)", async () => {
    const expected = nodeHashHex("sha224", "abc");
    expect(await digestHex("sha224", "abc")).toBe(expected);
    expect(expected).toBe(
      "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7",
    );
  });

  it("SHA-384 abc (oracle)", async () => {
    const expected = nodeHashHex("sha384", "abc");
    expect(await digestHex("sha384", "abc")).toBe(expected);
    expect(expected).toBe(
      "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
    );
  });

  it("SHA-512 abc (oracle)", async () => {
    const expected = nodeHashHex("sha512", "abc");
    expect(await digestHex("sha512", "abc")).toBe(expected);
    expect(expected).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    );
  });

  it("SHA3-512 abc (oracle)", async () => {
    const expected = nodeHashHex("sha3-512", "abc");
    expect(await digestHex("sha3-512", "abc")).toBe(expected);
    expect(expected).toBe(
      "b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0",
    );
  });

  it("RIPEMD-160 abc (oracle)", async () => {
    const expected = nodeHashHex("ripemd160", "abc");
    expect(await digestHex("ripemd160", "abc")).toBe(expected);
    expect(expected).toBe("8eb208f7e05d987a9b044a8e98c6b087f15a0bfc");
  });

  // Node 支持 blake2b512 (512位), 但不支持 blake2b-256 (256位变体); 用公开标准向量
  it("BLAKE2b-256 abc (公开标准向量)", async () => {
    // BLAKE2 官方测试向量 https://blake2.net/
    expect(await digestHex("blake2b-256", "abc")).toBe(
      "bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319",
    );
  });

  it("BLAKE2b-512 abc (oracle)", async () => {
    const expected = nodeHashHex("blake2b512", "abc");
    expect(await digestHex("blake2b-512", "abc")).toBe(expected);
    expect(expected).toBe(
      "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
    );
  });

  // BLAKE3: Node 不支持, 用公开标准向量 (https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors)
  it("BLAKE3 abc (公开标准向量)", async () => {
    // 官方向量: BLAKE3("abc") = 6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85
    expect(await digestHex("blake3", "abc")).toBe(
      "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85",
    );
  });

  // MD4: Node 当前版本不包含 MD4, 用 RFC1320 已知向量
  it("MD4 空串 (RFC1320 向量)", async () => {
    // RFC1320 Appendix A.5 Test Suite
    expect(await digestHex("md4", "")).toBe("31d6cfe0d16ae931b73c59d7e0c089c0");
  });

  it("MD4 abc (RFC1320 向量)", async () => {
    expect(await digestHex("md4", "abc")).toBe(
      "a448017aaf21d8525fc10ae87aa6729d",
    );
  });

  // Whirlpool: Node 不支持; 用往返验证并锁定 hash-wasm 确定性输出
  it("Whirlpool abc (往返确定性 + hash-wasm 锁定输出)", async () => {
    // hash-wasm Whirlpool("abc") 确定性输出 (已由实际运行获取)
    const expected =
      "4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5";
    expect(await digestHex("whirlpool", "abc")).toBe(expected);
    // 确定性: 同一输入两次输出相同
    expect(await digestHex("whirlpool", "abc")).toBe(expected);
    // 输出长度为 512 位 = 64 字节 = 128 十六进制字符
    expect(expected).toHaveLength(128);
  });
});

describe("computeHash 错误分支", () => {
  it("未知算法返回失败", async () => {
    const outcome = await computeHash("nope", utf8ToBytes("x"));
    expect(outcome.ok).toBe(false);
  });
});

describe("HASH_ALGORITHMS", () => {
  it("含常见算法且无重复 id", () => {
    const ids = HASH_ALGORITHMS.map((item) => item.id);
    expect(ids).toContain("sha256");
    expect(ids).toContain("sm3");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("表内每个算法均能成功计算 (全覆盖健康检查)", async () => {
    for (const algo of HASH_ALGORITHMS) {
      const outcome = await computeHash(algo.id, utf8ToBytes("test"));
      expect(outcome.ok, `算法 ${algo.id} 应成功`).toBe(true);
    }
  });
});
