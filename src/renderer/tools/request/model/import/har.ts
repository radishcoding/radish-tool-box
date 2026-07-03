import type { CollectionNode } from "../collection-tree";
import type { BodyConfig, HttpRequest } from "../types";
import { buildRequest, genId, item, type ImportedCollection } from "./types";

/**
 * 从 HAR postData 推断请求体.
 * @param postData HAR 的 postData 对象.
 * @returns 请求体配置.
 */
function bodyFromPostData(postData: unknown): BodyConfig {
  if (typeof postData !== "object" || postData === null) {
    return { type: "none" };
  }
  const pd = postData as {
    mimeType?: unknown;
    text?: unknown;
    params?: unknown;
  };
  if (Array.isArray(pd.params)) {
    const items = pd.params
      .filter(
        (p): p is { name: string; value: string } =>
          typeof p === "object" && p !== null,
      )
      .map((p) => item(String(p.name ?? ""), String(p.value ?? "")));
    return { type: "urlencoded", items };
  }
  if (typeof pd.text === "string") {
    const mime = typeof pd.mimeType === "string" ? pd.mimeType : "";
    return {
      type: "raw",
      rawType: mime.includes("json")
        ? "json"
        : mime.includes("xml")
          ? "xml"
          : "text",
      text: pd.text,
    };
  }
  return { type: "none" };
}

/**
 * 把一个 HAR request 对象转为 HttpRequest.
 * @param raw HAR entry.request.
 * @returns 高层请求 (无法解析返回默认 GET).
 */
function requestFromHar(raw: unknown): HttpRequest {
  if (typeof raw !== "object" || raw === null) {
    return buildRequest({});
  }
  const r = raw as {
    method?: unknown;
    url?: unknown;
    headers?: unknown;
    postData?: unknown;
  };
  const headers = Array.isArray(r.headers)
    ? r.headers
        .filter(
          (h): h is { name: string; value: string } =>
            typeof h === "object" && h !== null,
        )
        .filter((h) => !String(h.name ?? "").startsWith(":"))
        .map((h) => item(String(h.name ?? ""), String(h.value ?? "")))
    : [];
  return buildRequest({
    method: typeof r.method === "string" ? r.method.toUpperCase() : "GET",
    url: typeof r.url === "string" ? r.url : "",
    headers,
    body: bodyFromPostData(r.postData),
  });
}

/**
 * 解析 HAR 文本为集合 (每个 entry 一个请求节点).
 * @param json HAR JSON 文本.
 * @returns 导入集合.
 * @throws Error JSON 非法或结构不符时.
 */
export function parseHar(json: string): ImportedCollection {
  const parsed: unknown = JSON.parse(json);
  const entries = (parsed as { log?: { entries?: unknown } } | null)?.log
    ?.entries;
  if (!Array.isArray(entries)) {
    throw new Error("HAR 缺少 log.entries");
  }
  const nodes: CollectionNode[] = entries.map((entry, index) => {
    const request = requestFromHar(
      (entry as { request?: unknown } | null)?.request,
    );
    const name =
      request.url === ""
        ? `请求 ${index + 1}`
        : `${request.method} ${new URL(request.url, "http://x").pathname}`;
    return { id: genId("req"), type: "request", name, request };
  });
  return { name: "HAR 导入", variables: [], nodes };
}
