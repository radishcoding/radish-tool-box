import { useMemo, type ReactElement } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { PathFormat } from "../model/json-path";
import { semanticDiff, type DiffChangeType } from "../model/semantic-diff";

/**
 * 差异类型的中文标签与着色.
 */
const TYPE_META: Record<
  DiffChangeType,
  { readonly label: string; readonly className: string }
> = {
  create: { label: "增", className: "bg-emerald-100 text-emerald-700" },
  remove: { label: "删", className: "bg-rose-100 text-rose-700" },
  change: { label: "改", className: "bg-amber-100 text-amber-700" },
};

/**
 * 语义差异列表: 键序无关地比较 A/B, 列出路径化的增/删/改.
 */
export function JsonSemanticDiff({
  original,
  modified,
  pathFormat,
}: {
  readonly original: string;
  readonly modified: string;
  readonly pathFormat: PathFormat;
}): ReactElement {
  const result = useMemo(() => {
    try {
      return {
        changes: semanticDiff(original, modified, pathFormat),
        error: false,
      };
    } catch {
      return { changes: [], error: true };
    }
  }, [original, modified, pathFormat]);

  if (result.error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        无法语义对比: 存在非法 JSON
      </div>
    );
  }

  if (result.changes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        两侧数据一致 (键序无关)
      </div>
    );
  }

  return (
    <ScrollArea className="h-full rounded-xl border bg-card">
      <ul className="divide-y">
        {result.changes.map((change) => (
          <li
            key={`${change.type}:${change.pathText}`}
            className="flex items-start gap-2 px-3 py-1.5 font-mono text-xs"
          >
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded px-1 text-[10px] font-medium",
                TYPE_META[change.type].className,
              )}
            >
              {TYPE_META[change.type].label}
            </span>
            <span className="min-w-0 flex-1 break-all">
              <span className="text-foreground">{change.pathText}</span>
              {change.type === "change" && (
                <span className="text-muted-foreground">
                  {": "}
                  {change.oldValue} {"->"} {change.newValue}
                </span>
              )}
              {change.type === "create" && (
                <span className="text-muted-foreground">
                  {": "}
                  {change.newValue}
                </span>
              )}
              {change.type === "remove" && (
                <span className="text-muted-foreground">
                  {": "}
                  {change.oldValue}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
