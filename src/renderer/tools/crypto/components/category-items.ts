import { Fingerprint, Hash, KeyRound, Lock, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";

import type { AlgorithmCategory } from "../model/types";

/**
 * 左侧分类导航项的数据结构.
 * - id: 算法大类标识, 与 AlgorithmCategory 保持一致.
 * - label: 显示给用户的中文名称.
 * - icon: lucide-react 图标组件, 接受 className 以便外部控制尺寸.
 */
export interface CategoryItem {
  readonly id: AlgorithmCategory;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

/**
 * 全部分类导航项的有序列表.
 * sidebar 和 workspace 均从此处取数, 保证两者引用同一份数据源.
 * 新增算法大类时只需在此追加, 无需同步修改多个文件.
 */
export const CATEGORY_ITEMS: ReadonlyArray<CategoryItem> = [
  { id: "hmac", label: "HMAC", icon: Fingerprint },
  { id: "hash", label: "哈希摘要", icon: Hash },
  { id: "kdf", label: "口令算法", icon: ShieldCheck },
  { id: "symmetric", label: "对称算法", icon: KeyRound },
  { id: "asymmetric", label: "非对称类", icon: Lock },
];
