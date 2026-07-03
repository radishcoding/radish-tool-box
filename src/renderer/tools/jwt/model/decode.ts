import { decodeJwt, decodeProtectedHeader } from "jose";

import { fail, ok, type Outcome } from "@/lib/outcome";

import type { DecodedToken } from "./types";

/**
 * 解码 JWT 三段 (Header/Payload/Signature), 不做签名验证.
 * @param token JWT 紧凑串.
 * @returns 解码结果或失败原因.
 */
export function decodeToken(token: string): Outcome<DecodedToken> {
  const trimmed = token.trim();
  const segments = trimmed.split(".");
  if (segments.length !== 3) {
    return fail("JWT 应由 3 段以 . 分隔");
  }
  try {
    const header = decodeProtectedHeader(trimmed) as Record<string, unknown>;
    const payload = decodeJwt(trimmed) as Record<string, unknown>;
    return ok({ header, payload, signature: segments[2] });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
