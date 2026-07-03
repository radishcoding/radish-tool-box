import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

import { useRequestStore } from "../store/request-store";

/**
 * 状态码配色 (与响应区一致).
 * @param status HTTP 状态码, 0 表示请求失败.
 * @returns Tailwind 文本颜色类.
 */
function statusColor(status: number): string {
  if (status >= 200 && status < 300) {
    return "text-emerald-600";
  }
  if (status >= 400 || status === 0) {
    return "text-red-600";
  }
  return "text-amber-600";
}

/**
 * 历史分区: 倒序列出最近请求, 点击重开标签; 顶部一键清空.
 */
export function SidebarHistory(): ReactElement {
  const history = useRequestStore((s) => s.history);
  const openFromHistory = useRequestStore((s) => s.openFromHistory);
  const clearHistory = useRequestStore((s) => s.clearHistory);

  if (history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        暂无历史记录
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-end px-2 pt-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 cursor-pointer gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => clearHistory()}
        >
          <Trash2 className="size-3" />
          清空
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {history.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => openFromHistory(entry.id)}
            className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
          >
            <span
              className={`w-9 shrink-0 font-mono text-[10px] font-medium ${statusColor(entry.statusCode)}`}
            >
              {entry.statusCode === 0 ? "ERR" : entry.statusCode}
            </span>
            <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">
              {entry.method}
            </span>
            <span className="flex-1 truncate text-[10px] text-muted-foreground">
              {entry.url}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
