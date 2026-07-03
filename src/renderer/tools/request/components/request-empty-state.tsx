import { Send } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

import { useRequestStore } from "../store/request-store";

/**
 * 无打开标签时的空状态: 居中提示 + 新建请求按钮.
 */
export function RequestEmptyState(): ReactElement {
  const newTab = useRequestStore((s) => s.newTab);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <Send className="size-8 opacity-30" />
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-foreground/60">
          还没有打开的请求
        </p>
        <p className="text-xs">新建一个请求开始调试</p>
      </div>
      <Button size="sm" className="cursor-pointer" onClick={() => newTab()}>
        新建请求
      </Button>
    </div>
  );
}
