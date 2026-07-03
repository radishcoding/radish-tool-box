import type { HttpRequest, KeyValueItem } from "../types";

/**
 * 用单引号包裹一个 shell 参数 (内部单引号转义为 '\'\'').
 * @param value 原始值.
 * @returns 引用后的字符串.
 */
function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * 把启用的查询参数并入 URL.
 * @param url 原始 URL.
 * @param params 查询参数.
 * @returns 合并后的 URL.
 */
function withQuery(url: string, params: readonly KeyValueItem[]): string {
  const enabled = params.filter((p) => p.enabled && p.key !== "");
  if (enabled.length === 0) {
    return url;
  }
  const query = enabled
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

/**
 * 计算请求体对应的 curl 数据参数 (返回行数组, 无体时为空).
 * @param request 高层请求.
 * @returns curl 数据行 (如 ["--data '...'"]).
 */
function bodyLines(request: HttpRequest): string[] {
  const body = request.body;
  switch (body.type) {
    case "raw":
    case "graphql": {
      const text =
        body.type === "graphql"
          ? JSON.stringify({ query: body.query, variables: body.variables })
          : body.text;
      return [`--data ${quote(text)}`];
    }
    case "urlencoded":
      return body.items
        .filter((it) => it.enabled && it.key !== "")
        .map((it) => `--data ${quote(`${it.key}=${it.value}`)}`);
    case "formdata":
      return body.items
        .filter((it) => it.enabled && it.key !== "")
        .map((it) =>
          it.kind === "file"
            ? `-F ${quote(`${it.key}=@${it.value}`)}`
            : `-F ${quote(`${it.key}=${it.value}`)}`,
        );
    case "binary":
      return [`--data-binary ${quote(`@${body.filePath}`)}`];
    default:
      return [];
  }
}

/**
 * 计算鉴权对应的 curl 行 (basic/bearer/apikey-header; 其它降级为注释).
 * @param request 高层请求.
 * @returns curl 行数组.
 */
function authLines(request: HttpRequest): string[] {
  const auth = request.auth;
  switch (auth.type) {
    case "basic":
      return [`-u ${quote(`${auth.username}:${auth.password}`)}`];
    case "bearer":
      return [`-H ${quote(`Authorization: Bearer ${auth.token}`)}`];
    case "apikey":
      return auth.addTo === "header"
        ? [`-H ${quote(`${auth.key}: ${auth.value}`)}`]
        : [`# API Key (查询参数) ${auth.key}=${auth.value} 需手动加入 URL`];
    case "digest":
      return [`--digest -u ${quote(`${auth.username}:${auth.password}`)}`];
    case "none":
      return [];
    default:
      return [`# 鉴权类型 ${auth.type} 需手动补充`];
  }
}

/**
 * 把高层请求生成为 curl 命令 (多行用反斜杠续行).
 * 基于请求字面值; 变量解析由调用方在传入前完成.
 * @param request 高层请求.
 * @returns curl 命令文本.
 */
export function generateCurl(request: HttpRequest): string {
  const lines: string[] = [];
  const url = withQuery(request.url, request.params);
  lines.push(`curl -X ${request.method} ${quote(url)}`);
  for (const h of request.headers) {
    if (h.enabled && h.key !== "") {
      lines.push(`-H ${quote(`${h.key}: ${h.value}`)}`);
    }
  }
  lines.push(...authLines(request));
  lines.push(...bodyLines(request));
  return lines.join(" \\\n  ");
}
