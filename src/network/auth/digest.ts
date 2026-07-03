import { createHash, randomBytes } from "node:crypto";

/**
 * 服务端 Digest 挑战的关键字段.
 */
export interface DigestChallenge {
  readonly realm: string;
  readonly nonce: string;
  readonly qop?: string;
  readonly opaque?: string;
  readonly algorithm?: string;
}

/**
 * 计算 MD5 十六进制摘要.
 * @param text 输入.
 * @returns 十六进制摘要.
 */
function md5(text: string): string {
  return createHash("md5").update(text, "utf8").digest("hex");
}

/**
 * 从 WWW-Authenticate 头解析 Digest 挑战; 非 Digest 方案返回 undefined.
 * @param wwwAuthenticate WWW-Authenticate 头值.
 * @returns 挑战字段, 或 undefined.
 */
export function parseChallenge(
  wwwAuthenticate: string,
): DigestChallenge | undefined {
  const trimmed = wwwAuthenticate.trim();
  if (!/^digest\s/i.test(trimmed)) {
    return undefined;
  }
  const body = trimmed.replace(/^digest\s/i, "");
  const map: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    map[match[1].toLowerCase()] = match[2] ?? match[3].trim();
  }
  if (map.realm === undefined || map.nonce === undefined) {
    return undefined;
  }
  return {
    realm: map.realm,
    nonce: map.nonce,
    qop: map.qop,
    opaque: map.opaque,
    algorithm: map.algorithm,
  };
}

/**
 * 按 RFC 2617 计算 Digest 的 Authorization 头.
 * @param input 凭据/方法/uri/挑战/cnonce/nc.
 * @returns Authorization 头值 (不含 "Authorization:" 前缀).
 */
export function computeDigestHeader(input: {
  username: string;
  password: string;
  method: string;
  uri: string;
  challenge: DigestChallenge;
  cnonce: string;
  nc: string;
}): string {
  const { username, password, method, uri, challenge, cnonce, nc } = input;
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const qop =
    challenge.qop === undefined
      ? undefined
      : challenge.qop.split(",")[0].trim();
  const response =
    qop === undefined
      ? md5(`${ha1}:${challenge.nonce}:${ha2}`)
      : md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (challenge.opaque !== undefined) {
    parts.push(`opaque="${challenge.opaque}"`);
  }
  if (challenge.algorithm !== undefined) {
    parts.push(`algorithm=${challenge.algorithm}`);
  }
  if (qop !== undefined) {
    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  return `Digest ${parts.join(", ")}`;
}

/**
 * 生成随机 cnonce (客户端随机数).
 * @returns 十六进制随机串.
 */
export function generateCnonce(): string {
  return randomBytes(8).toString("hex");
}
