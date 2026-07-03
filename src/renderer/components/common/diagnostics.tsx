import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import type { Diagnostic } from "@/lib/outcome";

/**
 * 诊断级别到文字颜色的映射.
 */
const LEVEL_CLASS: Readonly<Record<Diagnostic["level"], string>> = {
  info: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

/**
 * 诊断区: 逐条展示校验/错误等调试辅助信息; 无项时不渲染.
 */
export function Diagnostics({
  items,
}: {
  readonly items: readonly Diagnostic[];
}): ReactElement | null {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 px-2.5 py-1.5">
      {items.map((item, index) => (
        <span
          key={`${item.level}-${index}`}
          className={cn("font-mono text-[11px]", LEVEL_CLASS[item.level])}
        >
          {item.message}
        </span>
      ))}
    </div>
  );
}
