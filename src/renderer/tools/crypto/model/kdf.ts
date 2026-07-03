import {
  argon2d,
  argon2i,
  argon2id,
  bcrypt,
  createSHA1,
  createSHA256,
  createSHA512,
  pbkdf2,
  scrypt,
  type IHasher,
} from "hash-wasm";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

import { hexToBytes, utf8ToBytes } from "./codec";
import { fail, ok, type Outcome } from "./types";

/**
 * KDF 参数字段, 决定面板渲染哪些控件.
 */
export type KdfField =
  | "hash"
  | "iterations"
  | "info"
  | "cost"
  | "blockSize"
  | "parallelism"
  | "memorySize"
  | "hashLength";

/**
 * KDF 算法描述符.
 */
export interface KdfAlgorithm {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly fields: readonly KdfField[];
}

/**
 * KDF 数值参数集合.
 */
export interface KdfNumbers {
  readonly iterations: number;
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelism: number;
  readonly memorySize: number;
  readonly hashLength: number;
}

/**
 * KDF 计算请求.
 */
export interface KdfRequest extends KdfNumbers {
  readonly algorithmId: string;
  readonly hashId: string;
  readonly password: Uint8Array;
  readonly salt: Uint8Array;
  readonly info: Uint8Array;
}

/**
 * KDF 算法表.
 */
export const KDF_ALGORITHMS: readonly KdfAlgorithm[] = [
  {
    id: "pbkdf2",
    label: "PBKDF2",
    available: true,
    fields: ["hash", "iterations", "hashLength"],
  },
  {
    id: "hkdf",
    label: "HKDF",
    available: true,
    fields: ["hash", "info", "hashLength"],
  },
  {
    id: "scrypt",
    label: "scrypt",
    available: true,
    fields: ["cost", "blockSize", "parallelism", "hashLength"],
  },
  { id: "bcrypt", label: "bcrypt", available: true, fields: ["cost"] },
  {
    id: "argon2id",
    label: "Argon2id",
    available: true,
    fields: ["iterations", "parallelism", "memorySize", "hashLength"],
  },
  {
    id: "argon2i",
    label: "Argon2i",
    available: true,
    fields: ["iterations", "parallelism", "memorySize", "hashLength"],
  },
  {
    id: "argon2d",
    label: "Argon2d",
    available: true,
    fields: ["iterations", "parallelism", "memorySize", "hashLength"],
  },
];

/**
 * PBKDF2/HKDF 可选底层哈希.
 */
export const KDF_HASHES: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
}> = [
  { id: "sha256", label: "SHA-256" },
  { id: "sha512", label: "SHA-512" },
  { id: "sha1", label: "SHA-1" },
];

/**
 * 各算法的默认数值参数.
 * @param id 算法 id.
 */
export function kdfDefaults(id: string): KdfNumbers {
  const base: KdfNumbers = {
    iterations: 3,
    cost: 10,
    blockSize: 8,
    parallelism: 1,
    memorySize: 65536,
    hashLength: 32,
  };
  switch (id) {
    case "pbkdf2":
      return { ...base, iterations: 100000, hashLength: 32 };
    case "hkdf":
      return { ...base, hashLength: 42 };
    case "scrypt":
      return {
        ...base,
        cost: 16384,
        blockSize: 8,
        parallelism: 1,
        hashLength: 64,
      };
    case "bcrypt":
      return { ...base, cost: 10 };
    default:
      return {
        ...base,
        iterations: 3,
        parallelism: 1,
        memorySize: 65536,
        hashLength: 32,
      };
  }
}

/**
 * 按 id 查 KDF 算法.
 * @param id 算法 id.
 */
export function findKdfAlgorithm(id: string): KdfAlgorithm | undefined {
  return KDF_ALGORITHMS.find((item) => item.id === id);
}

/**
 * PBKDF2 底层哈希工厂 (hash-wasm).
 */
const PBKDF2_FACTORIES: Readonly<Record<string, () => Promise<IHasher>>> = {
  sha256: () => createSHA256(),
  sha512: () => createSHA512(),
  sha1: () => createSHA1(),
};

/**
 * HKDF 底层哈希 (noble).
 */
const HKDF_HASHES = { sha256, sha512 } as const;

/**
 * Argon2 变体函数 (hash-wasm).
 */
const ARGON2_VARIANTS = { argon2id, argon2i, argon2d } as const;

/**
 * 执行 KDF/口令哈希计算.
 * @param request 已解码字节与数值参数.
 */
export async function computeKdf(
  request: KdfRequest,
): Promise<Outcome<Uint8Array>> {
  try {
    switch (request.algorithmId) {
      case "pbkdf2": {
        const factory = PBKDF2_FACTORIES[request.hashId];
        if (!factory) {
          return fail("PBKDF2 不支持该哈希");
        }
        const hex = await pbkdf2({
          password: request.password,
          salt: request.salt,
          iterations: request.iterations,
          hashLength: request.hashLength,
          hashFunction: factory(),
        });
        return ok(hexToBytes(hex), [
          {
            level: "info",
            message: `迭代 ${request.iterations} 次, 输出 ${request.hashLength} 字节`,
          },
        ]);
      }
      case "hkdf": {
        const hash = HKDF_HASHES[request.hashId as keyof typeof HKDF_HASHES];
        if (!hash) {
          return fail("HKDF 暂不支持该哈希 (用 SHA-256/512)");
        }
        /**
         * 空盐直接以空字节参与派生, 而非被替换为 RFC 5869 默认的
         * HashLen 个零字节; 调试工具的输出应完全由可见输入决定.
         */
        const out = hkdf(
          hash,
          request.password,
          request.salt,
          request.info,
          request.hashLength,
        );
        return ok(out, [
          { level: "info", message: `输出 ${request.hashLength} 字节` },
        ]);
      }
      case "scrypt": {
        const hex = await scrypt({
          password: request.password,
          salt: request.salt,
          costFactor: request.cost,
          blockSize: request.blockSize,
          parallelism: request.parallelism,
          hashLength: request.hashLength,
        });
        return ok(hexToBytes(hex), [
          {
            level: "info",
            message: `N=${request.cost} r=${request.blockSize} p=${request.parallelism}`,
          },
        ]);
      }
      case "bcrypt": {
        if (request.salt.length !== 16) {
          return fail(`bcrypt 盐应为 16 字节, 当前 ${request.salt.length}`, [
            { level: "error", message: "盐长度不符" },
          ]);
        }
        const text = await bcrypt({
          password: request.password,
          salt: request.salt,
          costFactor: request.cost,
        });
        return ok(utf8ToBytes(text), [
          { level: "info", message: `cost=${request.cost}` },
        ]);
      }
      case "argon2id":
      case "argon2i":
      case "argon2d": {
        const variant = ARGON2_VARIANTS[request.algorithmId];
        const hex = await variant({
          password: request.password,
          salt: request.salt,
          iterations: request.iterations,
          parallelism: request.parallelism,
          memorySize: request.memorySize,
          hashLength: request.hashLength,
        });
        return ok(hexToBytes(hex), [
          {
            level: "info",
            message: `t=${request.iterations} p=${request.parallelism} m=${request.memorySize}KiB`,
          },
        ]);
      }
      default:
        return fail("未知 KDF 算法");
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "KDF 计算失败");
  }
}
