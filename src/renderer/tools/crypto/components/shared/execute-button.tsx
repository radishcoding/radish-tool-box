import { Loader2, Play } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

/**
 * 重型算法的手动执行按钮; 运行中禁用并显示转圈.
 */
export function ExecuteButton({
  running,
  onExecute,
  label = "执行",
}: {
  readonly running: boolean;
  readonly onExecute: () => void;
  readonly label?: string;
}): ReactElement {
  return (
    <Button
      size="sm"
      onClick={onExecute}
      disabled={running}
      className="gap-1.5"
    >
      {running ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Play className="size-4" />
      )}
      {running ? "计算中" : label}
    </Button>
  );
}
