import type { VariableScopes } from "../../../../network/request-channels";

import type { Environment, KeyValueItem } from "./types";

/**
 * 把键值项列表转为变量表 (仅启用且非空键; secret 也计入, 仅 UI 掩码不影响发送).
 * @param items 键值项.
 * @returns 变量表.
 */
export function itemsToRecord(
  items: readonly KeyValueItem[],
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const item of items) {
    if (item.enabled && item.key !== "") {
      record[item.key] = item.value;
    }
  }
  return record;
}

/**
 * 渲染侧轻量模板解析 (供预览; 真实发送以主进程解析为准).
 * @param text 含 {{key}} 的文本.
 * @param vars 变量表.
 * @returns 替换后的文本 (未知键原样保留).
 */
export function resolveTemplate(
  text: string,
  vars: Readonly<Record<string, string>>,
): string {
  return text.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : value;
  });
}

/**
 * 由 store 数据装配四级变量作用域 (local 本阶段恒空, 脚本 setLocal 留阶段 3).
 * @param globals 全局变量.
 * @param activeEnv 活动环境 (无则 undefined).
 * @param collectionVars 标签所属集合的变量.
 * @returns 四级作用域.
 */
export function buildScopesFromStore(
  globals: readonly KeyValueItem[],
  activeEnv: Environment | undefined,
  collectionVars: readonly KeyValueItem[],
): VariableScopes {
  return {
    global: itemsToRecord(globals),
    collection: itemsToRecord(collectionVars),
    environment: activeEnv ? itemsToRecord(activeEnv.variables) : {},
    local: {},
  };
}
