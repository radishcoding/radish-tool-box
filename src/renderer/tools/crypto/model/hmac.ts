import {
  createHMAC,
  createMD5,
  createRIPEMD160,
  createSHA1,
  createSHA256,
  createSHA384,
  createSHA512,
  createSHA3,
  createSM3,
  type IHasher,
} from "hash-wasm";

import { hexToBytes } from "./codec";
import { fail, ok, type Outcome } from "./types";

/**
 * 可用于 HMAC 的底层哈希.
 */
export interface HmacHash {
  readonly id: string;
  readonly label: string;
}

/**
 * 哈希 id 到 hash-wasm 哈希工厂 (返回 Promise<IHasher>) 的映射.
 */
const HMAC_FACTORIES: Readonly<Record<string, () => Promise<IHasher>>> = {
  md5: () => createMD5(),
  sha1: () => createSHA1(),
  sha256: () => createSHA256(),
  sha384: () => createSHA384(),
  sha512: () => createSHA512(),
  "sha3-256": () => createSHA3(256),
  "sha3-512": () => createSHA3(512),
  ripemd160: () => createRIPEMD160(),
  sm3: () => createSM3(),
};

/**
 * HMAC 底层哈希表, 供面板下拉.
 */
export const HMAC_HASHES: readonly HmacHash[] = [
  { id: "sha256", label: "SHA-256" },
  { id: "sha1", label: "SHA-1" },
  { id: "sha512", label: "SHA-512" },
  { id: "sha384", label: "SHA-384" },
  { id: "sha3-256", label: "SHA3-256" },
  { id: "sha3-512", label: "SHA3-512" },
  { id: "md5", label: "MD5" },
  { id: "ripemd160", label: "RIPEMD-160" },
  { id: "sm3", label: "国密 SM3" },
];

/**
 * 计算 HMAC.
 * @param hashId 底层哈希 id (见 HMAC_HASHES).
 * @param key 密钥字节.
 * @param data 消息字节.
 */
export async function computeHmac(
  hashId: string,
  key: Uint8Array,
  data: Uint8Array,
): Promise<Outcome<Uint8Array>> {
  const factory = HMAC_FACTORIES[hashId];
  if (!factory) {
    return fail("未知 HMAC 哈希");
  }
  try {
    const hasher = await createHMAC(factory(), key);
    hasher.init();
    hasher.update(data);
    const hex = hasher.digest("hex");
    return ok(hexToBytes(hex), [
      { level: "info", message: `密钥 ${key.length} 字节` },
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "HMAC 计算失败");
  }
}
