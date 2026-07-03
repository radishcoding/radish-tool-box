import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind 类名, 自动去除冲突的工具类.
 * @param inputs 任意数量的类名片段 (字符串/数组/对象).
 * @returns 合并去重后的类名字符串.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
