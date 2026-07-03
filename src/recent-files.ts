/**
 * 最近文件列表上限.
 */
export const MAX_RECENT_FILES = 10;

/**
 * 把路径加入最近文件列表: 去重后置顶, 并截断到上限.
 */
export function addRecentFile(
  recent: readonly string[],
  filePath: string,
  max: number = MAX_RECENT_FILES,
): string[] {
  return [filePath, ...recent.filter((item) => item !== filePath)].slice(
    0,
    max,
  );
}
