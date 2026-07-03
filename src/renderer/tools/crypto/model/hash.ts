import {
  blake2b,
  blake3,
  crc32,
  md4,
  md5,
  ripemd160,
  sha1,
  sha224,
  sha256,
  sha384,
  sha512,
  sha3,
  sm3,
  whirlpool,
  type IDataType,
} from "hash-wasm";

import { hexToBytes } from "./codec";
import { fail, ok, type Outcome } from "./types";

/**
 * 哈希算法的 UI 元信息.
 */
export interface HashAlgorithm {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
}

/**
 * 算法 id 到 hash-wasm 计算函数 (返回十六进制字符串) 的映射.
 */
const HASH_RUNNERS: Readonly<
  Record<string, (data: IDataType) => Promise<string>>
> = {
  md4: (data) => md4(data),
  md5: (data) => md5(data),
  sha1: (data) => sha1(data),
  sha224: (data) => sha224(data),
  sha256: (data) => sha256(data),
  sha384: (data) => sha384(data),
  sha512: (data) => sha512(data),
  "sha3-256": (data) => sha3(data, 256),
  "sha3-512": (data) => sha3(data, 512),
  ripemd160: (data) => ripemd160(data),
  "blake2b-256": (data) => blake2b(data, 256),
  "blake2b-512": (data) => blake2b(data, 512),
  blake3: (data) => blake3(data),
  crc32: (data) => crc32(data),
  sm3: (data) => sm3(data),
  whirlpool: (data) => whirlpool(data),
};

/**
 * 哈希/摘要算法表, 供面板下拉; 顺序即展示顺序.
 */
export const HASH_ALGORITHMS: readonly HashAlgorithm[] = [
  { id: "md5", label: "MD5", available: true },
  { id: "sha1", label: "SHA-1", available: true },
  { id: "sha224", label: "SHA-224", available: true },
  { id: "sha256", label: "SHA-256", available: true },
  { id: "sha384", label: "SHA-384", available: true },
  { id: "sha512", label: "SHA-512", available: true },
  { id: "sha3-256", label: "SHA3-256", available: true },
  { id: "sha3-512", label: "SHA3-512", available: true },
  { id: "ripemd160", label: "RIPEMD-160", available: true },
  { id: "blake2b-256", label: "BLAKE2b-256", available: true },
  { id: "blake2b-512", label: "BLAKE2b-512", available: true },
  { id: "blake3", label: "BLAKE3", available: true },
  { id: "crc32", label: "CRC32", available: true },
  { id: "sm3", label: "国密 SM3", available: true },
  { id: "md4", label: "MD4", available: true },
  { id: "whirlpool", label: "Whirlpool", available: true },
];

/**
 * 计算指定哈希算法的摘要.
 * @param id 算法 id (见 HASH_ALGORITHMS).
 * @param data 输入字节.
 * @returns 成功时为摘要字节, 并带输入/摘要长度诊断.
 */
export async function computeHash(
  id: string,
  data: Uint8Array,
): Promise<Outcome<Uint8Array>> {
  const runner = HASH_RUNNERS[id];
  if (!runner) {
    return fail("未知哈希算法");
  }
  try {
    const hex = await runner(data);
    const digest = hexToBytes(hex);
    return ok(digest, [
      {
        level: "info",
        message: `输入 ${data.length} 字节, 摘要 ${digest.length} 字节`,
      },
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "哈希计算失败");
  }
}
