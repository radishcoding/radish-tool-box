import type { KeyValueItem } from "./request-channels";

/**
 * 把启用的非空键查询参数追加到 URL 查询串.
 * @param urlString 原始 URL.
 * @param params 查询参数项.
 * @returns 合并后的 URL 字符串.
 */
export function mergeQueryParams(
  urlString: string,
  params: readonly KeyValueItem[],
): string {
  const url = new URL(urlString);
  for (const param of params) {
    if (param.enabled && param.key !== "") {
      // 跳过已存在的同名同值项, 避免与 URL 自带查询 (含已同步项) 重复追加.
      if (!url.searchParams.getAll(param.key).includes(param.value)) {
        url.searchParams.append(param.key, param.value);
      }
    }
  }
  return url.toString();
}
