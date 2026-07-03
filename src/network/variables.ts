import type { VariableScopes } from "./request-channels";

/**
 * 按优先级 (local > environment > collection > global) 合并四级变量.
 * @param scopes 四级作用域快照.
 * @returns 扁平化后的变量表.
 */
export function flattenScopes(scopes: VariableScopes): Record<string, string> {
  return {
    ...scopes.global,
    ...scopes.collection,
    ...scopes.environment,
    ...scopes.local,
  };
}

/**
 * 替换文本中的 {{key}} 占位; 未知键原样保留.
 * @param text 含占位的文本.
 * @param vars 扁平变量表.
 * @returns 替换后的文本.
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
