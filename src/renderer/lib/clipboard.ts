/**
 * 把文本写入系统剪贴板; 失败静默 (调用方不依赖结果).
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 忽略剪贴板失败 (无权限等)
  }
}
