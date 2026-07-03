import { compactVerify } from "jose";

import { fail, ok, type Outcome } from "@/lib/outcome";

import { resolveKey } from "./keys";
import type { JwtAlg, VerifyResult } from "./types";

/**
 * 验证 JWT 的签名 (仅校验签名本身, 过期等时间约束由 claims 表单独展示).
 * @param token JWT 紧凑串.
 * @param keyText 密钥文本 (secret / PEM / JWK).
 * @param alg 算法.
 * @returns 验签结果; 密钥缺失/格式错时为失败 Outcome.
 * @remarks alg 来自调用方 (通常取自 header.alg), 本函数不做 alg confusion 防护; 调试器场景用户同时掌控 token 与密钥, 风险可接受.
 */
export async function verifyToken(
  token: string,
  keyText: string,
  alg: JwtAlg,
): Promise<Outcome<VerifyResult>> {
  let key: CryptoKey | Uint8Array;
  try {
    key = await resolveKey(keyText, alg, "verify");
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  try {
    await compactVerify(token.trim(), key);
    return ok({ valid: true, reason: "签名有效" });
  } catch (err) {
    return ok({
      valid: false,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
