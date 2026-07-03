import type { CollectionNode } from "../collection-tree";
import {
  createDefaultRequest,
  type HttpRequest,
  type KeyValueItem,
} from "../types";

/**
 * 导入产生的集合 (名称 + 变量 + 节点树), 供 store 直接落库.
 */
export interface ImportedCollection {
  readonly name: string;
  readonly variables: readonly KeyValueItem[];
  readonly nodes: readonly CollectionNode[];
}

/**
 * 生成一个唯一 id.
 * @param prefix id 前缀.
 * @returns 唯一 id.
 */
export function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * 在默认请求基础上覆盖部分字段, 构造完整 HttpRequest.
 * @param over 覆盖字段.
 * @returns 完整请求.
 */
export function buildRequest(over: Partial<HttpRequest>): HttpRequest {
  return { ...createDefaultRequest(), ...over };
}

/**
 * 构造一个启用的键值项.
 * @param key 键.
 * @param value 值.
 * @returns 键值项.
 */
export function item(key: string, value: string): KeyValueItem {
  return { id: genId("kv"), key, value, enabled: true };
}
