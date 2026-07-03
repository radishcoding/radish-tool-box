/**
 * 按显示文本字符长度由短到长稳定排序; 返回新数组, 不修改入参.
 * 仅用于下拉等的展示顺序, 不应改动数据本身或其默认值.
 * @param items 原始条目.
 * @param toLabel 取条目的显示文本.
 * @returns 按文本长度升序排列的新数组.
 */
export function sortByLength<T>(
  items: readonly T[],
  toLabel: (item: T) => string,
): readonly T[] {
  return [...items].sort((a, b) => toLabel(a).length - toLabel(b).length);
}
