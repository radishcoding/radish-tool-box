import type { CollectionNode } from "../collection-tree";
import type {
  AuthConfig,
  BodyConfig,
  HttpRequest,
  KeyValueItem,
} from "../types";
import { buildRequest, genId, item, type ImportedCollection } from "./types";

/**
 * 取对象属性 (类型安全的 unknown 读取).
 * @param obj 对象.
 * @param key 键.
 * @returns 属性值.
 */
function get(obj: unknown, key: string): unknown {
  return typeof obj === "object" && obj !== null
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}

/**
 * 解析 Postman url (字符串或 {raw} 对象) 为字符串.
 * @param url Postman url 字段.
 * @returns URL 字符串.
 */
function parseUrl(url: unknown): string {
  if (typeof url === "string") {
    return url;
  }
  const raw = get(url, "raw");
  return typeof raw === "string" ? raw : "";
}

/**
 * 解析 Postman header 数组.
 * @param header Postman header 字段.
 * @returns 键值头.
 */
function parseHeaders(header: unknown): KeyValueItem[] {
  if (!Array.isArray(header)) {
    return [];
  }
  return header
    .map((h) =>
      item(String(get(h, "key") ?? ""), String(get(h, "value") ?? "")),
    )
    .filter((h) => h.key !== "");
}

/**
 * 解析 Postman body.
 * @param body Postman body 字段.
 * @returns 请求体配置.
 */
function parseBody(body: unknown): BodyConfig {
  const mode = get(body, "mode");
  if (mode === "raw") {
    const raw = String(get(body, "raw") ?? "");
    const lang = get(get(body, "options"), "raw");
    const language = String(get(lang, "language") ?? "");
    return {
      type: "raw",
      rawType:
        language === "json" || raw.trim().startsWith("{") ? "json" : "text",
      text: raw,
    };
  }
  if (mode === "urlencoded") {
    const arr = get(body, "urlencoded");
    const items = Array.isArray(arr)
      ? arr.map((p) =>
          item(String(get(p, "key") ?? ""), String(get(p, "value") ?? "")),
        )
      : [];
    return { type: "urlencoded", items };
  }
  if (mode === "formdata") {
    const arr = get(body, "formdata");
    const items = Array.isArray(arr)
      ? arr.map((p) => ({
          id: genId("fd"),
          key: String(get(p, "key") ?? ""),
          value: String(get(p, "src") ?? get(p, "value") ?? ""),
          enabled: true,
          kind:
            get(p, "type") === "file" ? ("file" as const) : ("text" as const),
        }))
      : [];
    return { type: "formdata", items };
  }
  if (mode === "graphql") {
    const gql = get(body, "graphql");
    return {
      type: "graphql",
      query: String(get(gql, "query") ?? ""),
      variables: String(get(gql, "variables") ?? ""),
    };
  }
  return { type: "none" };
}

/**
 * 解析 Postman auth.
 * @param auth Postman auth 字段.
 * @returns 鉴权配置.
 */
function parseAuth(auth: unknown): AuthConfig {
  const type = get(auth, "type");
  const kv = (arr: unknown, key: string): string => {
    if (!Array.isArray(arr)) {
      return "";
    }
    const found = arr.find((e) => get(e, "key") === key);
    return String(get(found, "value") ?? "");
  };
  if (type === "basic") {
    return {
      type: "basic",
      username: kv(get(auth, "basic"), "username"),
      password: kv(get(auth, "basic"), "password"),
    };
  }
  if (type === "bearer") {
    return { type: "bearer", token: kv(get(auth, "bearer"), "token") };
  }
  if (type === "apikey") {
    return {
      type: "apikey",
      key: kv(get(auth, "apikey"), "key"),
      value: kv(get(auth, "apikey"), "value"),
      addTo: kv(get(auth, "apikey"), "in") === "query" ? "query" : "header",
    };
  }
  return { type: "none" };
}

/**
 * 从 Postman event 数组取前置/后置脚本.
 * @param event Postman event 字段.
 * @param listen "prerequest" 或 "test".
 * @returns 脚本文本.
 */
function parseScript(event: unknown, listen: string): string {
  if (!Array.isArray(event)) {
    return "";
  }
  const found = event.find((e) => get(e, "listen") === listen);
  const exec = get(get(found, "script"), "exec");
  return Array.isArray(exec) ? exec.map((l) => String(l)).join("\n") : "";
}

/**
 * 把一个 Postman item 转为请求节点.
 * @param node Postman item (request).
 * @returns 请求高层模型.
 */
function requestFromItem(node: unknown): HttpRequest {
  const request = get(node, "request");
  return buildRequest({
    method: String(get(request, "method") ?? "GET").toUpperCase(),
    url: parseUrl(get(request, "url")),
    headers: parseHeaders(get(request, "header")),
    body: parseBody(get(request, "body")),
    auth: parseAuth(get(request, "auth")),
    preScript: parseScript(get(node, "event"), "prerequest"),
    postScript: parseScript(get(node, "event"), "test"),
  });
}

/**
 * 递归把 Postman item 数组转为集合节点.
 * @param items Postman item 数组.
 * @returns 集合节点.
 */
function parseItems(items: unknown): CollectionNode[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((node) => {
    const name = String(get(node, "name") ?? "未命名");
    if (Array.isArray(get(node, "item"))) {
      return {
        id: genId("fld"),
        type: "folder",
        name,
        children: parseItems(get(node, "item")),
      };
    }
    return {
      id: genId("req"),
      type: "request",
      name,
      request: requestFromItem(node),
    };
  });
}

/**
 * 解析 Postman Collection v2.1 文本为集合.
 * @param json Postman 集合 JSON 文本.
 * @returns 导入集合.
 * @throws Error JSON 非法时.
 */
export function parsePostman(json: string): ImportedCollection {
  const parsed: unknown = JSON.parse(json);
  const name = String(get(get(parsed, "info"), "name") ?? "Postman 集合");
  const variable = get(parsed, "variable");
  const variables = Array.isArray(variable)
    ? variable.map((v) =>
        item(String(get(v, "key") ?? ""), String(get(v, "value") ?? "")),
      )
    : [];
  return { name, variables, nodes: parseItems(get(parsed, "item")) };
}
