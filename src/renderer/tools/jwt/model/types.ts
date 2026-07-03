/**
 * 支持的 JWS 签名算法.
 */
export type JwtAlg =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512"
  | "PS256"
  | "PS384"
  | "PS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA";

/**
 * 解码后的 JWT 三段 (不验签).
 */
export interface DecodedToken {
  readonly header: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature: string;
}

/**
 * 签名验证结果.
 */
export interface VerifyResult {
  readonly valid: boolean;
  readonly reason: string;
}

/**
 * 签发草稿 (UI 编辑态; 密钥单独保存于内存, 不在此).
 */
export interface SignDraft {
  readonly alg: JwtAlg;
  readonly headerExtra: string;
  readonly payload: string;
}

/**
 * claims 表的一行.
 */
export interface ClaimRow {
  readonly key: string;
  readonly label: string;
  readonly raw: string;
  readonly note?: string;
  readonly status?: "ok" | "expired" | "not-yet";
}
