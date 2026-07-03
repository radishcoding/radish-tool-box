/**
 * 拼接多块 base64 文本并解码为字节 (渲染层无 Buffer, 用 atob + Uint8Array).
 * @param chunks base64 字符串块.
 * @returns 解码后的字节.
 */
export function decodeBase64Chunks(chunks: readonly string[]): Uint8Array {
  const binaries = chunks.map((chunk) => atob(chunk));
  const total = binaries.reduce((sum, b) => sum + b.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const binary of binaries) {
    for (let i = 0; i < binary.length; i += 1) {
      bytes[offset + i] = binary.charCodeAt(i);
    }
    offset += binary.length;
  }
  return bytes;
}

/**
 * 把字节按 UTF-8 解码为文本.
 * @param bytes 输入字节.
 * @returns 文本.
 */
export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * 把字节编码为 base64 (分块避免超长参数; 渲染层无 Buffer, 用 btoa).
 * @param bytes 输入字节.
 * @returns base64 字符串.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * 由 content-type 推断文件扩展名 (无匹配回退 txt).
 * @param contentType content-type 头.
 * @returns 扩展名 (不含点).
 */
function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase().split(";")[0].trim();
  if (ct.startsWith("image/")) {
    const sub = ct.slice(6);
    return sub === "jpeg" ? "jpg" : sub === "svg+xml" ? "svg" : sub;
  }
  const map: Record<string, string> = {
    "application/json": "json",
    "text/html": "html",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/javascript": "js",
    "text/javascript": "js",
    "text/css": "css",
    "text/plain": "txt",
  };
  return map[ct] ?? "txt";
}

/**
 * 为响应体推断保存文件名: 优先取 URL 末段带扩展名的文件名, 否则按 content-type 生成.
 * @param url 请求 URL (可能含 {{var}} 而非法, 会被忽略).
 * @param contentType content-type 头.
 * @returns 建议文件名.
 */
export function deriveFileName(url: string, contentType: string): string {
  try {
    const segment =
      new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    if (segment.includes(".")) {
      return segment;
    }
  } catch {
    // URL 非法 (如含未解析变量), 忽略, 走 content-type 分支.
  }
  return `response.${extFromContentType(contentType)}`;
}

/**
 * 取响应头单值 (数组取首个, 缺省取空串).
 * @param value 头值.
 * @returns 单值字符串.
 */
export function singleHeaderValue(
  value: string | string[] | undefined,
): string {
  if (value === undefined) {
    return "";
  }
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

/**
 * 按 content-type 把响应体归类 (决定预览方式).
 * @param contentType content-type 头.
 * @returns 体类型.
 */
export function detectBodyKind(
  contentType: string,
): "json" | "html" | "image" | "text" {
  const lower = contentType.toLowerCase();
  if (lower.includes("json")) {
    return "json";
  }
  if (lower.includes("html")) {
    return "html";
  }
  if (lower.startsWith("image/")) {
    return "image";
  }
  return "text";
}

/**
 * 美化响应体: JSON 缩进格式化, 其余原样返回 (非法 JSON 也原样).
 * @param text 响应体文本.
 * @param contentType content-type 头.
 * @returns 美化后的文本.
 */
export function formatPretty(text: string, contentType: string): string {
  if (detectBodyKind(contentType) !== "json") {
    return text;
  }
  try {
    return JSON.stringify(JSON.parse(text), undefined, 2);
  } catch {
    return text;
  }
}

/**
 * 从响应头的 set-cookie 提取 cookie 名值对 (用于响应区 Cookies 页).
 * @param headers 响应头.
 * @returns cookie 名值对列表.
 */
export function parseSetCookieHeaders(
  headers: Record<string, string | string[]>,
): readonly { readonly name: string; readonly value: string }[] {
  const raw = headers["set-cookie"];
  if (raw === undefined) {
    return [];
  }
  const list = Array.isArray(raw) ? raw : [raw];
  const cookies: { name: string; value: string }[] = [];
  for (const entry of list) {
    const first = entry.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) {
      cookies.push({
        name: first.slice(0, eq).trim(),
        value: first.slice(eq + 1).trim(),
      });
    }
  }
  return cookies;
}

/**
 * 解析 Cookie 请求头 (形如 "a=b; c=d") 为名值对.
 * @param value Cookie 头字符串 (空串表示无).
 * @returns cookie 名值对列表.
 */
export function parseCookieHeader(
  value: string,
): readonly { readonly name: string; readonly value: string }[] {
  // 兼容空串与 (旧状态遗留的) undefined, 避免 split 抛错.
  if (!value) {
    return [];
  }
  const cookies: { name: string; value: string }[] = [];
  for (const part of value.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      cookies.push({
        name: part.slice(0, eq).trim(),
        value: part.slice(eq + 1).trim(),
      });
    }
  }
  return cookies;
}

/**
 * 向 HTML 注入 <base href>, 使相对/根相对资源 (图片/CSS) 能按原始请求地址解析.
 * 优先插入 <head> 内; 无 head 时补建; 皆无时前置 (片段场景).
 * @param html 原始 HTML.
 * @param url 原始请求 URL (空串则原样返回).
 * @returns 注入 base 后的 HTML.
 */
export function injectBaseHref(html: string, url: string): string {
  if (url === "") {
    return html;
  }
  const escaped = url
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const baseTag = `<base href="${escaped}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html[^>]*>/i,
      (match) => `${match}<head>${baseTag}</head>`,
    );
  }
  return `${baseTag}${html}`;
}

/**
 * JSON 值的递归类型 (对象/数组/字符串/数字/布尔/null).
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * tryParseJson 的结果: 成功携带解析值, 失败仅标记 (供 Pretty 视图回退纯文本).
 */
export type JsonParseResult =
  | { readonly ok: true; readonly value: JsonValue }
  | { readonly ok: false };

/**
 * 尝试把文本解析为 JSON 值; 非法 JSON 返回 ok:false 而不抛错.
 * @param text 响应体文本.
 * @returns 解析结果.
 */
export function tryParseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch {
    return { ok: false };
  }
}

/**
 * cookie 来源: set 表示本次响应经 Set-Cookie 设置, sent 表示本次请求带出.
 */
export type CookieSource = "set" | "sent";

/**
 * 响应区 Cookies 页展示的单条 cookie.
 */
export interface CookieEntry {
  readonly name: string;
  readonly value: string;
  readonly source: CookieSource;
}

/**
 * 汇总"这次请求相关"的 cookie: 合并请求带出的 (sent) 与响应设置的 (set), 按名去重.
 * 同名时以"设置的"为准 (它是本次响应产生的最新状态).
 * @param input setCookie 为整条链累积的原始 Set-Cookie 行; sent 为最终跳发送的 Cookie 头.
 * @returns 合并去重后的 cookie 列表.
 */
export function collectCookies(input: {
  readonly setCookie: readonly string[];
  readonly sent: string;
}): readonly CookieEntry[] {
  const byName = new Map<string, CookieEntry>();
  for (const c of parseCookieHeader(input.sent)) {
    byName.set(c.name, { ...c, source: "sent" });
  }
  for (const c of parseSetCookieHeaders({
    "set-cookie": [...input.setCookie],
  })) {
    byName.set(c.name, { ...c, source: "set" });
  }
  return [...byName.values()];
}
