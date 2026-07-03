import { parse as parseYaml } from "yaml";

import type { CollectionNode } from "../collection-tree";
import type { BodyConfig, HttpRequest, KeyValueItem } from "../types";
import { buildRequest, genId, item, type ImportedCollection } from "./types";

/**
 * 取对象属性 (unknown 安全读取).
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
 * HTTP 方法集合 (OpenAPI operation 键).
 */
const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

/**
 * 骨架递归深度上限 (防止 schema 自引用无限展开).
 */
const MAX_DEPTH = 6;

/**
 * 计算 API 基础 URL (3.x servers 或 2.0 host+basePath+scheme).
 * @param doc OpenAPI 文档.
 * @returns 基础 URL.
 */
function baseUrl(doc: unknown): string {
  const servers = get(doc, "servers");
  if (Array.isArray(servers) && servers.length > 0) {
    return String(get(servers[0], "url") ?? "").replace(/\/$/, "");
  }
  const host = get(doc, "host");
  if (typeof host === "string") {
    const schemes = get(doc, "schemes");
    const scheme =
      Array.isArray(schemes) && schemes.length > 0
        ? String(schemes[0])
        : "https";
    const basePath =
      typeof get(doc, "basePath") === "string"
        ? String(get(doc, "basePath"))
        : "";
    return `${scheme}://${host}${basePath}`.replace(/\/$/, "");
  }
  return "";
}

/**
 * 取参数的示例值: example > schema.example > schema.default; 无则空串.
 * @param param 参数对象.
 * @returns 字符串值.
 */
function paramValue(param: unknown): string {
  const ex =
    get(param, "example") ??
    get(get(param, "schema"), "example") ??
    get(get(param, "schema"), "default");
  return ex === undefined ? "" : String(ex);
}

/**
 * 解析本地 $ref (#/... 指向文档内节点).
 * @param doc 根文档.
 * @param ref 引用字符串.
 * @returns 目标节点或 undefined.
 */
function refTarget(doc: unknown, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }
  let cur: unknown = doc;
  for (const seg of ref.slice(2).split("/")) {
    cur = get(cur, decodeURIComponent(seg));
  }
  return cur;
}

/**
 * 展开 schema 的 $ref (无 ref 原样返回).
 * @param doc 根文档.
 * @param schema schema 节点.
 * @returns 展开后的 schema.
 */
function resolveSchema(doc: unknown, schema: unknown): unknown {
  const ref = get(schema, "$ref");
  return typeof ref === "string" ? refTarget(doc, ref) : schema;
}

/**
 * 由 schema 递归构造示例 JSON 骨架 (example/default 优先, 否则按类型给占位).
 * @param doc 根文档 (用于解析 $ref).
 * @param schema schema 节点.
 * @param depth 当前递归深度.
 * @returns 示例值.
 */
function skeleton(doc: unknown, schema: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || schema === undefined) {
    return null;
  }
  const s = resolveSchema(doc, schema);
  const ex = get(s, "example") ?? get(s, "default");
  if (ex !== undefined) {
    return ex;
  }
  const type = get(s, "type");
  const props = get(s, "properties");
  if (type === "object" || props !== undefined) {
    const out: Record<string, unknown> = {};
    if (typeof props === "object" && props !== null) {
      for (const [key, value] of Object.entries(
        props as Record<string, unknown>,
      )) {
        out[key] = skeleton(doc, value, depth + 1);
      }
    }
    return out;
  }
  if (type === "array") {
    return [skeleton(doc, get(s, "items"), depth + 1)];
  }
  if (type === "integer" || type === "number") {
    return 0;
  }
  if (type === "boolean") {
    return false;
  }
  return "";
}

/**
 * 由 3.x requestBody 构造请求体 (JSON 优先, 其次 urlencoded).
 * @param doc 根文档.
 * @param op operation 对象.
 * @returns 请求体配置.
 */
function bodyFromRequestBody(doc: unknown, op: unknown): BodyConfig {
  const content = get(get(op, "requestBody"), "content");
  if (typeof content !== "object" || content === null) {
    return { type: "none" };
  }
  const keys = Object.keys(content as Record<string, unknown>);
  const jsonKey = keys.find((k) => k.includes("json"));
  if (jsonKey !== undefined) {
    const media = (content as Record<string, unknown>)[jsonKey];
    const example =
      get(media, "example") ?? get(get(media, "schema"), "example");
    const value =
      example !== undefined ? example : skeleton(doc, get(media, "schema"), 0);
    return {
      type: "raw",
      rawType: "json",
      text: JSON.stringify(value, null, 2),
    };
  }
  const formKey = keys.find((k) => k.includes("urlencoded"));
  if (formKey !== undefined) {
    const props = get(
      resolveSchema(
        doc,
        get((content as Record<string, unknown>)[formKey], "schema"),
      ),
      "properties",
    );
    const items =
      typeof props === "object" && props !== null
        ? Object.keys(props as Record<string, unknown>).map((k) => item(k, ""))
        : [];
    return { type: "urlencoded", items };
  }
  return { type: "none" };
}

/**
 * 由 operation 的 body/formData 参数 (OpenAPI 2.0) 构造请求体.
 * @param doc 根文档.
 * @param params 参数数组.
 * @returns 请求体配置.
 */
function bodyFromV2Params(
  doc: unknown,
  params: readonly unknown[],
): BodyConfig {
  const bodyParam = params.find((p) => get(p, "in") === "body");
  if (bodyParam !== undefined) {
    return {
      type: "raw",
      rawType: "json",
      text: JSON.stringify(skeleton(doc, get(bodyParam, "schema"), 0), null, 2),
    };
  }
  const form = params.filter((p) => get(p, "in") === "formData");
  if (form.length > 0) {
    return {
      type: "urlencoded",
      items: form.map((p) => item(String(get(p, "name") ?? ""), paramValue(p))),
    };
  }
  return { type: "none" };
}

/**
 * 用路径参数替换 URL 模板: 有示例用示例, 否则转为 {{name}} 变量占位.
 * @param path 路径模板.
 * @param params 参数数组.
 * @returns 替换后的路径.
 */
function applyPathParams(path: string, params: readonly unknown[]): string {
  return path.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    const p = params.find(
      (x) => get(x, "in") === "path" && get(x, "name") === name,
    );
    const value = p !== undefined ? paramValue(p) : "";
    return value !== "" ? value : `{{${name}}}`;
  });
}

/**
 * 把一个 operation 转为请求节点 (含查询参数/头部/路径参数/请求体).
 * @param doc 根文档.
 * @param base 基础 URL.
 * @param path 路径模板.
 * @param method 方法.
 * @param op operation 对象.
 * @returns 请求节点.
 */
function nodeFromOp(
  doc: unknown,
  base: string,
  path: string,
  method: string,
  op: unknown,
): CollectionNode {
  const summary = String(
    get(op, "summary") ??
      get(op, "operationId") ??
      `${method.toUpperCase()} ${path}`,
  );
  const rawParams = get(op, "parameters");
  const params = Array.isArray(rawParams) ? rawParams : [];
  const query: KeyValueItem[] = params
    .filter((p) => get(p, "in") === "query")
    .map((p) => item(String(get(p, "name") ?? ""), paramValue(p)));
  const headers: KeyValueItem[] = params
    .filter((p) => get(p, "in") === "header")
    .map((p) => item(String(get(p, "name") ?? ""), paramValue(p)));
  const body =
    get(op, "requestBody") !== undefined
      ? bodyFromRequestBody(doc, op)
      : bodyFromV2Params(doc, params);
  const request: HttpRequest = buildRequest({
    method: method.toUpperCase(),
    url: `${base}${applyPathParams(path, params)}`,
    params: query,
    headers,
    body,
  });
  return { id: genId("req"), type: "request", name: summary, request };
}

/**
 * 解析 OpenAPI 文本 (JSON 或 YAML) 为集合 (按首个 tag 分组, 无 tag 归 "默认").
 * @param text OpenAPI 文档文本.
 * @returns 导入集合.
 * @throws Error 解析失败或缺 paths 时.
 */
export function parseOpenApi(text: string): ImportedCollection {
  let doc: unknown;
  try {
    doc = text.trim().startsWith("{") ? JSON.parse(text) : parseYaml(text);
  } catch (err) {
    throw new Error(
      `OpenAPI 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const paths = get(doc, "paths");
  if (typeof paths !== "object" || paths === null) {
    throw new Error("OpenAPI 缺少 paths");
  }
  const base = baseUrl(doc);
  const groups = new Map<string, CollectionNode[]>();
  for (const [path, pathItem] of Object.entries(
    paths as Record<string, unknown>,
  )) {
    for (const method of METHODS) {
      const op = get(pathItem, method);
      if (op === undefined) {
        continue;
      }
      const tags = get(op, "tags");
      const tag =
        Array.isArray(tags) && tags.length > 0 ? String(tags[0]) : "默认";
      const node = nodeFromOp(doc, base, path, method, op);
      const list = groups.get(tag) ?? [];
      list.push(node);
      groups.set(tag, list);
    }
  }
  const nodes: CollectionNode[] = [...groups.entries()].map(
    ([tag, children]) => ({
      id: genId("fld"),
      type: "folder",
      name: tag,
      children,
    }),
  );
  const title = String(get(get(doc, "info"), "title") ?? "OpenAPI 集合");
  return { name: title, variables: [], nodes };
}
