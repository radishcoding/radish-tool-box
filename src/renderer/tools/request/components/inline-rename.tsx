import { useEffect, useRef, type ReactElement } from "react";

import { cn } from "@/lib/utils";

/**
 * 内联重命名输入框: 挂载即聚焦全选, 回车/失焦确定, Esc 取消; 名称为空或未变视为取消.
 * 确定与取消均只触发一次 (回车后失焦不重复提交).
 * @param value 当前名称.
 * @param onCommit 确定新名称 (已 trim, 非空且有变化).
 * @param onCancel 取消 (退出编辑不改名).
 * @param className 附加样式.
 */
export function InlineRename({
  value,
  onCommit,
  onCancel,
  className,
}: {
  readonly value: string;
  readonly onCommit: (name: string) => void;
  readonly onCancel: () => void;
  readonly className?: string;
}): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (input !== null) {
      input.focus();
      input.select();
    }
  }, []);

  const finish = (rename: boolean): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    const trimmed = inputRef.current?.value.trim() ?? "";
    if (rename && trimmed !== "" && trimmed !== value) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      defaultValue={value}
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      className={cn(
        "h-6 min-w-0 flex-1 rounded border bg-background px-1 text-xs outline-none focus:border-ring",
        className,
      )}
    />
  );
}
