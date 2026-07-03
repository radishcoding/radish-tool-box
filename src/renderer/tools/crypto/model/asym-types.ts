/**
 * 非对称操作子模式.
 */
export type AsymOperation =
  | "encrypt"
  | "decrypt"
  | "sign"
  | "verify"
  | "derive";

/**
 * 算法的可选变体 (曲线或 RSA 方案).
 */
export interface AsymVariant {
  readonly id: string;
  readonly label: string;
}

/**
 * 非对称算法描述符.
 */
export interface AsymAlgorithm {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly keyEncoding: "pem" | "hex";
  readonly operations: readonly AsymOperation[];
  readonly variants: readonly AsymVariant[];
  readonly schemes: readonly AsymVariant[];
}

/**
 * 非对称计算结果的判别联合.
 */
export type AsymResult =
  | { readonly kind: "bytes"; readonly value: Uint8Array }
  | { readonly kind: "boolean"; readonly value: boolean }
  | {
      readonly kind: "keypair";
      readonly publicKey: string;
      readonly privateKey: string;
    };

/**
 * 非对称计算请求.
 */
export interface AsymRequest {
  readonly algorithmId: string;
  readonly operation: AsymOperation;
  readonly variant: string;
  readonly scheme: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly data: Uint8Array;
  readonly signature: Uint8Array;
}

/**
 * EC 系曲线变体.
 */
const EC_CURVES: readonly AsymVariant[] = [
  { id: "secp256k1", label: "secp256k1" },
  { id: "p256", label: "P-256" },
  { id: "p384", label: "P-384" },
  { id: "p521", label: "P-521" },
];

/**
 * 非对称算法表.
 */
export const ASYM_ALGORITHMS: readonly AsymAlgorithm[] = [
  {
    id: "rsa",
    label: "RSA",
    available: true,
    keyEncoding: "pem",
    operations: ["encrypt", "decrypt", "sign", "verify"],
    variants: [
      { id: "2048", label: "2048 位" },
      { id: "3072", label: "3072 位" },
      { id: "4096", label: "4096 位" },
    ],
    schemes: [
      { id: "oaep", label: "OAEP (加解密)" },
      { id: "pkcs1", label: "PKCS1v1.5 (加解密)" },
      { id: "pss", label: "PSS (签名)" },
      { id: "pkcs1-sign", label: "PKCS1v1.5 (签名)" },
    ],
  },
  {
    id: "ecdsa",
    label: "ECDSA",
    available: true,
    keyEncoding: "hex",
    operations: ["sign", "verify"],
    variants: EC_CURVES,
    schemes: [],
  },
  {
    id: "ed25519",
    label: "Ed25519",
    available: true,
    keyEncoding: "hex",
    operations: ["sign", "verify"],
    variants: [],
    schemes: [],
  },
  {
    id: "ecdh",
    label: "ECDH",
    available: true,
    keyEncoding: "hex",
    operations: ["derive"],
    variants: EC_CURVES,
    schemes: [],
  },
  {
    id: "x25519",
    label: "X25519",
    available: true,
    keyEncoding: "hex",
    operations: ["derive"],
    variants: [],
    schemes: [],
  },
  {
    id: "sm2",
    label: "国密 SM2",
    available: true,
    keyEncoding: "hex",
    operations: ["encrypt", "decrypt", "sign", "verify"],
    variants: [],
    schemes: [],
  },
];

/**
 * 按 id 查非对称算法.
 * @param id 算法 id.
 */
export function findAsymAlgorithm(id: string): AsymAlgorithm | undefined {
  return ASYM_ALGORITHMS.find((item) => item.id === id);
}
