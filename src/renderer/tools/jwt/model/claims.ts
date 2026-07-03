import type { ClaimRow } from "./types";

/**
 * 标准 claim 的中文标签 (并据此固定展示顺序).
 */
const CLAIM_LABELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "iss", label: "签发者 (iss)" },
  { key: "sub", label: "主题 (sub)" },
  { key: "aud", label: "受众 (aud)" },
  { key: "exp", label: "过期时间 (exp)" },
  { key: "nbf", label: "生效时间 (nbf)" },
  { key: "iat", label: "签发时间 (iat)" },
  { key: "jti", label: "JWT ID (jti)" },
];

/**
 * 时间型 claim 集合 (值为 Unix 秒).
 */
const TIME_CLAIMS = new Set(["exp", "nbf", "iat"]);

/**
 * 把任意 claim 值转可读字符串.
 * @param value claim 值.
 * @returns 字符串表示.
 */
function rawString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * 由 payload 构造 claims 表行: 标准 claim 按固定顺序在前 (带时间转换与状态),
 * 其余自定义 claim 追加在后.
 * @param payload JWT payload.
 * @param nowMs 当前时间 (毫秒), 由调用方注入以便测试.
 * @returns claims 表行.
 */
export function buildClaims(
  payload: Readonly<Record<string, unknown>>,
  nowMs: number,
): ClaimRow[] {
  const rows: ClaimRow[] = [];
  const known = new Set(CLAIM_LABELS.map((c) => c.key));

  for (const { key, label } of CLAIM_LABELS) {
    if (!(key in payload)) {
      continue;
    }
    const value = payload[key];
    if (TIME_CLAIMS.has(key) && typeof value === "number") {
      const ms = value * 1000;
      const note = new Date(ms).toLocaleString();
      let status: ClaimRow["status"] = "ok";
      if (key === "exp" && nowMs > ms) {
        status = "expired";
      } else if (key === "nbf" && nowMs < ms) {
        status = "not-yet";
      }
      rows.push({ key, label, raw: String(value), note, status });
    } else {
      rows.push({ key, label, raw: rawString(value) });
    }
  }

  for (const key of Object.keys(payload)) {
    if (!known.has(key)) {
      rows.push({ key, label: key, raw: rawString(payload[key]) });
    }
  }
  return rows;
}
