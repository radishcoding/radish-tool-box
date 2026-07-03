import type { AuthConfig, KeyValueItem } from "../request-channels";

/**
 * 鉴权产生的附加头与查询参数.
 */
export interface AuthAdditions {
  readonly headers: readonly KeyValueItem[];
  readonly queryParams: readonly KeyValueItem[];
}

/**
 * 空附加.
 */
const EMPTY: AuthAdditions = { headers: [], queryParams: [] };

/**
 * 构造一个启用的键值项.
 * @param key 键.
 * @param value 值.
 * @returns 键值项.
 */
function authItem(key: string, value: string): KeyValueItem {
  return { id: `auth-${key}`, key, value, enabled: true };
}

/**
 * 计算静态鉴权 (无网络) 产生的附加头/查询参数.
 * 仅处理 basic/bearer/apikey; digest/oauth2/awsv4/none 返回空 (各自在别处处理).
 * @param auth 鉴权配置.
 * @returns 附加头与查询参数.
 */
export function applyStaticAuth(auth: AuthConfig): AuthAdditions {
  switch (auth.type) {
    case "basic": {
      const token = Buffer.from(`${auth.username}:${auth.password}`).toString(
        "base64",
      );
      return {
        headers: [authItem("Authorization", `Basic ${token}`)],
        queryParams: [],
      };
    }
    case "bearer":
      return {
        headers: [authItem("Authorization", `Bearer ${auth.token}`)],
        queryParams: [],
      };
    case "apikey":
      return auth.addTo === "query"
        ? { headers: [], queryParams: [authItem(auth.key, auth.value)] }
        : { headers: [authItem(auth.key, auth.value)], queryParams: [] };
    default:
      return EMPTY;
  }
}
