import type { KeyValueItem } from "../../../../network/request-channels";

/**
 * 把一个 URL 拆为基址/查询串/片段三段 (保留 {{var}}, 不依赖 URL 解析以容忍模板).
 * @param url 原始 URL.
 * @returns 基址 (含协议主机路径)、查询串 (不含 ?)、片段 (含 #).
 */
function splitUrl(url: string): {
  readonly base: string;
  readonly query: string;
  readonly fragment: string;
} {
  const hashIndex = url.indexOf("#");
  const head = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const queryIndex = head.indexOf("?");
  const base = queryIndex >= 0 ? head.slice(0, queryIndex) : head;
  const query = queryIndex >= 0 ? head.slice(queryIndex + 1) : "";
  return { base, query, fragment };
}

/**
 * 解码查询串片段; 保留 {{var}} 原样, 解码失败回退原值.
 * @param value 待解码片段.
 * @returns 解码后的值.
 */
function decodePart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * 编码查询串片段; 编码后把 {{var}} 的花括号还原, 以保留模板可读.
 * @param value 待编码片段.
 * @returns 编码后的值.
 */
function encodePart(value: string): string {
  return encodeURIComponent(value)
    .replace(/%7B%7B/g, "{{")
    .replace(/%7D%7D/g, "}}");
}

/**
 * 由 URL 的查询串同步出键值参数项; 解析出的项为启用, 并保留上次的禁用项 (URL 不承载禁用).
 * 尽量复用同名旧项的 id 以减少列表抖动.
 * @param url 当前 URL.
 * @param prevParams 上一份参数项 (用于保留禁用项与复用 id).
 * @returns 同步后的参数项.
 */
export function parseQueryToParams(
  url: string,
  prevParams: readonly KeyValueItem[],
): readonly KeyValueItem[] {
  const { query } = splitUrl(url);
  const idByKey = new Map<string, string>();
  for (const item of prevParams) {
    if (!idByKey.has(item.key)) {
      idByKey.set(item.key, item.id);
    }
  }
  const parsed: KeyValueItem[] = [];
  if (query !== "") {
    for (const pair of query.split("&")) {
      if (pair === "") {
        continue;
      }
      const eq = pair.indexOf("=");
      const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
      const rawValue = eq >= 0 ? pair.slice(eq + 1) : "";
      const key = decodePart(rawKey);
      parsed.push({
        id: idByKey.get(key) ?? `param-${crypto.randomUUID()}`,
        key,
        value: decodePart(rawValue),
        enabled: true,
      });
    }
  }
  // 保留之前被禁用的项 (它们不出现在 URL 查询里, 但应留在表中可再启用).
  const disabled = prevParams.filter((item) => !item.enabled);
  return [...parsed, ...disabled];
}

/**
 * 用启用的键值参数项重建 URL 的查询串; 保留基址与片段, 禁用项不入 URL.
 * @param url 当前 URL.
 * @param params 参数项.
 * @returns 重建查询串后的 URL.
 */
export function applyParamsToUrl(
  url: string,
  params: readonly KeyValueItem[],
): string {
  const { base, fragment } = splitUrl(url);
  const query = params
    .filter((item) => item.enabled && item.key !== "")
    .map((item) => `${encodePart(item.key)}=${encodePart(item.value)}`)
    .join("&");
  return query === "" ? `${base}${fragment}` : `${base}?${query}${fragment}`;
}
