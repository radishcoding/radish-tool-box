import { importJWK, importPKCS8, importSPKI } from "jose";

import type { JwtAlg } from "./types";

/**
 * 解析密钥文本为 jose 可用的密钥.
 * - HS*: 对称密钥, 直接用 UTF-8 字节.
 * - 文本以 { 开头: 视为 JWK.
 * - 其余: 验签用公钥 SPKI PEM, 签发用私钥 PKCS8 PEM.
 * @param keyText 密钥文本 (secret / PEM / JWK).
 * @param alg 算法.
 * @param usage 用途 (verify 用公钥, sign 用私钥).
 * @returns jose 密钥.
 * @throws Error 密钥格式错误时.
 * @remarks 调用方有责任确保 alg 与密钥类型匹配; 本函数信任传入的 alg, 不做 alg-密钥交叉校验; 用于调试器场景, 不应直接复用于认证上下文.
 */
export async function resolveKey(
  keyText: string,
  alg: JwtAlg,
  usage: "verify" | "sign",
): Promise<CryptoKey | Uint8Array> {
  const text = keyText.trim();
  if (text === "") {
    throw new Error("缺少密钥");
  }
  if (alg.startsWith("HS")) {
    return new TextEncoder().encode(text);
  }
  if (text.startsWith("{")) {
    return await importJWK(JSON.parse(text) as Record<string, unknown>, alg);
  }
  return usage === "verify"
    ? await importSPKI(text, alg)
    : await importPKCS8(text, alg);
}
