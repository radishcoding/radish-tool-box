import type { AuthConfig } from "../request-channels";

/**
 * oauth2 鉴权配置.
 */
type OAuth2Auth = Extract<AuthConfig, { type: "oauth2" }>;

/**
 * 令牌端点请求.
 */
export interface TokenRequest {
  readonly url: string;
  readonly body: string;
  readonly contentType: string;
}

/**
 * 构造 client_credentials 授权的令牌请求 (application/x-www-form-urlencoded).
 * @param auth oauth2 配置.
 * @returns 令牌端点请求.
 */
export function buildClientCredentialsRequest(auth: OAuth2Auth): TokenRequest {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  });
  if (auth.scope !== "") {
    params.append("scope", auth.scope);
  }
  return {
    url: auth.tokenUrl,
    body: params.toString(),
    contentType: "application/x-www-form-urlencoded",
  };
}

/**
 * 从令牌端点 JSON 响应取出 access_token.
 * @param json 响应体文本.
 * @returns access_token.
 * @throws Error 响应非法或缺少 access_token 时.
 */
export function parseTokenResponse(json: string): string {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { access_token?: unknown }).access_token !== "string"
  ) {
    throw new Error("OAuth2 令牌响应缺少 access_token");
  }
  return (parsed as { access_token: string }).access_token;
}

/**
 * 计算 Authorization 头值; 空前缀回退为 "Bearer".
 * @param token 访问令牌.
 * @param prefix 头前缀.
 * @returns 头值.
 */
export function bearerHeaderValue(token: string, prefix: string): string {
  return `${prefix === "" ? "Bearer" : prefix} ${token}`;
}
