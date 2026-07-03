import { SignJWT } from "jose";

import { fail, ok, type Outcome } from "@/lib/outcome";

import { resolveKey } from "./keys";
import type { SignDraft } from "./types";

/**
 * 把 JSON 文本解析为对象; 空串视为空对象.
 * @param text JSON 文本.
 * @returns 解析后的对象.
 * @throws Error 解析失败或非对象时.
 */
function parseObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed === "") {
    return {};
  }
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("应为 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

/**
 * 按草稿与密钥签发 JWT.
 * @param draft 签发草稿 (alg / 额外头 / payload).
 * @param keyText 密钥文本 (secret / PEM / JWK).
 * @returns 签发的紧凑串或失败原因.
 */
export async function signToken(
  draft: SignDraft,
  keyText: string,
): Promise<Outcome<string>> {
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = { ...parseObject(draft.headerExtra), alg: draft.alg };
    payload = parseObject(draft.payload);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  try {
    const key = await resolveKey(keyText, draft.alg, "sign");
    const token = await new SignJWT(payload)
      .setProtectedHeader(header as { alg: string })
      .sign(key);
    return ok(token);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
