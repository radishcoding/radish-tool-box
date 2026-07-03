import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

import { CODEGEN_TARGETS } from "../model/codegen";
import type { HttpRequest } from "../model/types";

/**
 * 代码生成弹层: 选目标语言 + 展示代码 + 复制.
 * @param request 当前请求.
 * @param onClose 关闭回调.
 */
export function CodegenDialog({
  request,
  onClose,
}: {
  readonly request: HttpRequest;
  readonly onClose: () => void;
}): ReactElement {
  const [targetId, setTargetId] = useState(CODEGEN_TARGETS[0].id);
  const target =
    CODEGEN_TARGETS.find((t) => t.id === targetId) ?? CODEGEN_TARGETS[0];
  const code = target.generate(request);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="生成代码"
        className="flex w-[36rem] flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">生成代码</span>
          <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
            {CODEGEN_TARGETS.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                size="sm"
                onClick={() => setTargetId(t.id)}
                className={cn(
                  "h-7 cursor-pointer px-3 text-xs transition-all",
                  targetId === t.id
                    ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
        <Textarea
          readOnly
          value={code}
          className="min-h-48 resize-none bg-muted/40 font-mono text-xs leading-relaxed"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={onClose}
          >
            关闭
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => void copyText(code)}
          >
            复制
          </Button>
        </div>
      </div>
    </div>
  );
}
