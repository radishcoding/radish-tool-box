import { gcm } from "@noble/ciphers/aes.js";
import { chacha20, chacha20poly1305 } from "@noble/ciphers/chacha.js";
import CryptoJS from "crypto-js";
import { sm4 } from "sm-crypto-v2";

import { bytesToHex, hexToBytes } from "./codec";
import { fail, ok, type Diagnostic, type Outcome } from "./types";

/**
 * 分组密码工作模式.
 */
export type SymmetricMode = "ecb" | "cbc" | "cfb" | "ofb" | "ctr" | "gcm";

/**
 * 分组密码填充方式.
 */
export type SymmetricPadding =
  | "pkcs7"
  | "iso10126"
  | "ansix923"
  | "zero"
  | "none";

/**
 * 对称操作方向.
 */
export type SymmetricOperation = "encrypt" | "decrypt";

/**
 * 对称算法描述符: 决定面板显示哪些参数与如何校验.
 */
export interface SymmetricAlgorithm {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly kind: "block" | "stream" | "aead";
  readonly keySizes: readonly number[];
  readonly modes: readonly SymmetricMode[];
  readonly ivSize: number;
  readonly supportsAad: boolean;
}

/**
 * 对称计算入参 (字节均已解码).
 */
export interface SymmetricParams {
  readonly algorithmId: string;
  readonly mode: SymmetricMode;
  readonly padding: SymmetricPadding;
  readonly operation: SymmetricOperation;
  readonly key: Uint8Array;
  readonly iv: Uint8Array;
  readonly aad: Uint8Array;
  readonly data: Uint8Array;
}

/**
 * 对称算法表, 顺序即面板展示顺序.
 */
export const SYMMETRIC_ALGORITHMS: readonly SymmetricAlgorithm[] = [
  {
    id: "aes",
    label: "AES",
    available: true,
    kind: "block",
    keySizes: [16, 24, 32],
    modes: ["ecb", "cbc", "cfb", "ofb", "ctr"],
    ivSize: 16,
    supportsAad: false,
  },
  {
    id: "aes-gcm",
    label: "AES-GCM",
    available: true,
    kind: "aead",
    keySizes: [16, 24, 32],
    modes: ["gcm"],
    ivSize: 12,
    supportsAad: true,
  },
  {
    id: "des",
    label: "DES",
    available: true,
    kind: "block",
    keySizes: [8],
    modes: ["ecb", "cbc", "cfb", "ofb", "ctr"],
    ivSize: 8,
    supportsAad: false,
  },
  {
    id: "3des",
    label: "3DES",
    available: true,
    kind: "block",
    keySizes: [16, 24],
    modes: ["ecb", "cbc", "cfb", "ofb", "ctr"],
    ivSize: 8,
    supportsAad: false,
  },
  {
    id: "sm4",
    label: "国密 SM4",
    available: true,
    kind: "block",
    keySizes: [16],
    modes: ["ecb", "cbc"],
    ivSize: 16,
    supportsAad: false,
  },
  {
    id: "chacha20",
    label: "ChaCha20",
    available: true,
    kind: "stream",
    keySizes: [32],
    modes: [],
    ivSize: 12,
    supportsAad: false,
  },
  {
    id: "chacha20-poly1305",
    label: "ChaCha20-Poly1305",
    available: true,
    kind: "aead",
    keySizes: [32],
    modes: [],
    ivSize: 12,
    supportsAad: true,
  },
  {
    id: "rc4",
    label: "RC4",
    available: true,
    kind: "stream",
    keySizes: [],
    modes: [],
    ivSize: 0,
    supportsAad: false,
  },
  {
    id: "rabbit",
    label: "Rabbit",
    available: true,
    kind: "stream",
    keySizes: [16],
    modes: [],
    ivSize: 0,
    supportsAad: false,
  },
];

/**
 * 按 id 查对称算法描述符.
 * @param id 算法 id.
 */
export function findSymmetricAlgorithm(
  id: string,
): SymmetricAlgorithm | undefined {
  return SYMMETRIC_ALGORITHMS.find((item) => item.id === id);
}

/**
 * 判断当前算法与模式下是否需要 IV/Nonce.
 * @param algo 算法描述符.
 * @param mode 当前模式.
 */
export function symmetricNeedsIv(
  algo: SymmetricAlgorithm,
  mode: SymmetricMode,
): boolean {
  if (algo.ivSize <= 0) {
    return false;
  }
  // 流密码 (如 ChaCha20) 也有 nonce, ivSize > 0 时同样返回 true.
  return !(algo.kind === "block" && mode === "ecb");
}

/**
 * 字节转 crypto-js WordArray (经十六进制桥接, 确保按原始密钥处理).
 */
function toWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Hex.parse(bytesToHex(bytes));
}

/**
 * crypto-js WordArray 转字节.
 */
function fromWordArray(word: CryptoJS.lib.WordArray): Uint8Array {
  return hexToBytes(word.toString(CryptoJS.enc.Hex));
}

/**
 * crypto-js 密码算法映射.
 */
const CRYPTOJS_CIPHERS: Readonly<Record<string, typeof CryptoJS.AES>> = {
  aes: CryptoJS.AES,
  des: CryptoJS.DES,
  "3des": CryptoJS.TripleDES,
  rc4: CryptoJS.RC4,
  rabbit: CryptoJS.RabbitLegacy,
};

/**
 * crypto-js 模式映射.
 */
const CRYPTOJS_MODES: Readonly<Record<string, object>> = {
  ecb: CryptoJS.mode.ECB,
  cbc: CryptoJS.mode.CBC,
  cfb: CryptoJS.mode.CFB,
  ofb: CryptoJS.mode.OFB,
  ctr: CryptoJS.mode.CTR,
};

/**
 * crypto-js 填充映射.
 */
const CRYPTOJS_PADDINGS: Readonly<Record<SymmetricPadding, object>> = {
  pkcs7: CryptoJS.pad.Pkcs7,
  iso10126: CryptoJS.pad.Iso10126,
  ansix923: CryptoJS.pad.AnsiX923,
  zero: CryptoJS.pad.ZeroPadding,
  none: CryptoJS.pad.NoPadding,
};

/**
 * 校验密钥与 IV 长度, 返回诊断; 致命问题置 error.
 */
function validate(
  algo: SymmetricAlgorithm,
  params: SymmetricParams,
): { readonly diagnostics: Diagnostic[]; readonly error?: string } {
  const diagnostics: Diagnostic[] = [
    { level: "info", message: `密钥 ${params.key.length} 字节` },
  ];
  if (algo.keySizes.length > 0 && !algo.keySizes.includes(params.key.length)) {
    return {
      diagnostics,
      error: `密钥应为 ${algo.keySizes.join("/")} 字节, 当前 ${params.key.length}`,
    };
  }
  if (symmetricNeedsIv(algo, params.mode)) {
    diagnostics.push({ level: "info", message: `IV ${params.iv.length} 字节` });
    if (params.iv.length !== algo.ivSize) {
      return {
        diagnostics,
        error: `IV 应为 ${algo.ivSize} 字节, 当前 ${params.iv.length}`,
      };
    }
  }
  if (
    algo.id === "sm4" &&
    params.padding !== "pkcs7" &&
    params.padding !== "none"
  ) {
    return { diagnostics, error: "SM4 仅支持 PKCS7 或 NoPadding 填充" };
  }
  return { diagnostics };
}

/**
 * crypto-js 路径: AES/DES/3DES (分组) 与 RC4/Rabbit (流).
 */
function runCryptoJs(
  algo: SymmetricAlgorithm,
  params: SymmetricParams,
): Uint8Array {
  const cipher = CRYPTOJS_CIPHERS[algo.id];
  const key = toWordArray(params.key);
  const config: Record<string, unknown> = {};
  if (algo.kind === "block") {
    config.mode = CRYPTOJS_MODES[params.mode];
    config.padding = CRYPTOJS_PADDINGS[params.padding];
    if (symmetricNeedsIv(algo, params.mode)) {
      config.iv = toWordArray(params.iv);
    }
  }
  if (params.operation === "encrypt") {
    const result = cipher.encrypt(toWordArray(params.data), key, config);
    return fromWordArray(result.ciphertext);
  }
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: toWordArray(params.data),
  });
  const result = cipher.decrypt(cipherParams, key, config);
  return fromWordArray(result);
}

/**
 * SM4 路径 (sm-crypto-v2, 仅 ECB/CBC).
 * sm-crypto-v2 的 sm4 模块以 namespace 形式导出 encrypt/decrypt.
 * 需用带 `output: "array"` 重载签名以获得 Uint8Array 返回.
 */
function runSm4(params: SymmetricParams): Uint8Array {
  const padding = (params.padding === "none" ? "none" : "pkcs#7") as
    | "none"
    | "pkcs#7";
  const mode = params.mode === "cbc" ? ("cbc" as const) : ("ecb" as const);
  const iv = params.mode === "cbc" ? bytesToHex(params.iv) : undefined;
  const keyHex = bytesToHex(params.key);
  // 显式指定 output: "array" 以匹配返回 Uint8Array 的重载
  const options = { mode, iv, padding, output: "array" as const };
  const result =
    params.operation === "encrypt"
      ? sm4.encrypt(params.data, keyHex, options)
      : sm4.decrypt(params.data, keyHex, options);
  return Uint8Array.from(result);
}

/**
 * noble 路径: AES-GCM / ChaCha20 / ChaCha20-Poly1305.
 */
function runNoble(
  algo: SymmetricAlgorithm,
  params: SymmetricParams,
): Uint8Array {
  const aad = params.aad.length > 0 ? params.aad : undefined;
  if (algo.id === "aes-gcm") {
    const cipher = gcm(params.key, params.iv, aad);
    return params.operation === "encrypt"
      ? cipher.encrypt(params.data)
      : cipher.decrypt(params.data);
  }
  if (algo.id === "chacha20-poly1305") {
    const cipher = chacha20poly1305(params.key, params.iv, aad);
    return params.operation === "encrypt"
      ? cipher.encrypt(params.data)
      : cipher.decrypt(params.data);
  }
  // chacha20 流密码: 加解密同为 XOR
  return chacha20(params.key, params.iv, params.data);
}

/**
 * 执行对称加解密.
 * @param params 已解码的字节参数.
 * @returns 成功时为结果字节, 失败时带可读原因与诊断.
 */
export function runSymmetric(params: SymmetricParams): Outcome<Uint8Array> {
  const algo = findSymmetricAlgorithm(params.algorithmId);
  if (!algo) {
    return fail("未知对称算法");
  }
  const checked = validate(algo, params);
  if (checked.error) {
    return fail(checked.error, checked.diagnostics);
  }
  try {
    let result: Uint8Array;
    if (algo.id === "sm4") {
      result = runSm4(params);
    } else if (algo.kind === "aead" || algo.id === "chacha20") {
      result = runNoble(algo, params);
    } else {
      result = runCryptoJs(algo, params);
    }
    return ok(result, checked.diagnostics);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "对称计算失败",
      checked.diagnostics,
    );
  }
}
