import psl from "psl";

/**
 * 已存储的 Cookie.
 */
export interface StoredCookie {
  readonly domain: string;
  readonly path: string;
  readonly name: string;
  readonly value: string;
  readonly expires?: number;
  readonly secure: boolean;
  readonly httpOnly: boolean;
}

/**
 * 解析单条 Set-Cookie 文本.
 * @param header Set-Cookie 值.
 * @param requestHost 请求主机名 (用作默认 domain).
 * @returns 解析出的 Cookie; 无法解析返回 undefined.
 */
function parseSetCookie(
  header: string,
  requestHost: string,
): StoredCookie | undefined {
  const parts = header.split(";").map((p) => p.trim());
  const first = parts[0];
  const eq = first.indexOf("=");
  if (eq <= 0) {
    return undefined;
  }
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  let domain = requestHost;
  let domainExplicit = false;
  let path = "/";
  let expires: number | undefined;
  let secure = false;
  let httpOnly = false;
  for (const attr of parts.slice(1)) {
    const [rawKey, ...rest] = attr.split("=");
    const key = rawKey.trim().toLowerCase();
    const attrValue = rest.join("=").trim();
    if (key === "domain" && attrValue !== "") {
      domain = attrValue.replace(/^\./, "").toLowerCase();
      domainExplicit = true;
    } else if (key === "path" && attrValue !== "") {
      path = attrValue;
    } else if (key === "expires") {
      const ms = Date.parse(attrValue);
      if (!Number.isNaN(ms)) {
        expires = ms;
      }
    } else if (key === "max-age") {
      const seconds = Number(attrValue);
      if (!Number.isNaN(seconds)) {
        expires = Date.now() + seconds * 1000;
      }
    } else if (key === "secure") {
      secure = true;
    } else if (key === "httponly") {
      httpOnly = true;
    }
  }
  const host = requestHost.toLowerCase();
  if (domainExplicit) {
    // RFC6265: 显式 Domain 必须 domain-match 请求主机, 否则拒绝 (防跨域 Cookie 注入).
    if (!domainMatches(host, domain)) {
      return undefined;
    }
    // 公共后缀列表防护: Domain 不得为公共后缀 (com / co.uk 等), 防 "超级 Cookie";
    // 但允许 Domain 恰等请求主机 (如 localhost / 内网单标签主机 的本机 Cookie).
    if (psl.get(domain) === null && domain !== host) {
      return undefined;
    }
  }
  return { domain, path, name, value, expires, secure, httpOnly };
}

/**
 * 主机是否匹配 cookie 域 (等于或为其子域).
 * @param host 请求主机.
 * @param domain cookie 域.
 * @returns 匹配返回 true.
 */
function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

/**
 * 请求路径是否匹配 cookie 路径 (按 RFC 6265 5.1.4 的边界规则).
 * 须完全相等, 或以 cookie 路径加 "/" 为前缀, 避免 "/api" 误配 "/apiv2".
 * @param requestPath 请求路径.
 * @param cookiePath cookie 路径.
 * @returns 匹配返回 true.
 */
function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) {
    return true;
  }
  const boundary = cookiePath.endsWith("/") ? cookiePath : cookiePath + "/";
  return requestPath.startsWith(boundary);
}

/**
 * 按域名管理的 Cookie Jar (进程内, 非持久).
 */
export class CookieJar {
  private cookies: StoredCookie[] = [];

  /**
   * 从响应的 Set-Cookie 头存入.
   * @param urlString 产生该响应的请求 URL.
   * @param setCookieHeaders Set-Cookie 头数组.
   */
  setFromHeaders(urlString: string, setCookieHeaders: readonly string[]): void {
    const url = new URL(urlString);
    for (const header of setCookieHeaders) {
      const cookie = parseSetCookie(header, url.hostname);
      if (cookie === undefined) {
        continue;
      }
      this.cookies = this.cookies.filter(
        (c) =>
          !(
            c.name === cookie.name &&
            c.domain === cookie.domain &&
            c.path === cookie.path
          ),
      );
      this.cookies.push(cookie);
    }
  }

  /**
   * 计算对某 URL 应发送的 Cookie 头值.
   * @param urlString 目标 URL.
   * @returns 形如 "a=1; b=2" 的 Cookie 头; 无匹配返回空串.
   */
  headerFor(urlString: string): string {
    const url = new URL(urlString);
    const isHttps = url.protocol === "https:";
    const now = Date.now();
    return this.cookies
      .filter((c) => c.expires === undefined || c.expires > now)
      .filter((c) => domainMatches(url.hostname, c.domain))
      .filter((c) => pathMatches(url.pathname, c.path))
      .filter((c) => !c.secure || isHttps)
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  /**
   * 返回当前全部 Cookie 的只读快照.
   * @returns Cookie 列表.
   */
  getAll(): readonly StoredCookie[] {
    return [...this.cookies];
  }
}
