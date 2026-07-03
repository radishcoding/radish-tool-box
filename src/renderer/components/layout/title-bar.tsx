import { Copy, Minus, Square, X } from "lucide-react";
import {
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 单个窗口控制按钮 (最小化/最大化/关闭).
 */
function WindowControlButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  readonly onClick: () => void;
  readonly danger?: boolean;
}): ReactElement {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "no-drag h-9 w-11 cursor-pointer rounded-none text-muted-foreground hover:bg-muted hover:text-foreground",
        danger && "hover:bg-destructive hover:text-white",
      )}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}

/**
 * 自定义窗口标题栏: 可拖拽空白区 + 右侧窗口控制 (最小化/最大化/关闭).
 *
 * 原生标题栏已在主进程隐藏 (titleBarStyle: hidden); 控制行为经 contextBridge
 * 暴露的 window.windowControls 走 IPC 调用主进程.
 */
export function TitleBar(): ReactElement {
  const [maximized, setMaximized] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    void window.windowControls.isMaximized().then((value) => {
      if (active) {
        setMaximized(value);
      }
    });
    const unsubscribe = window.windowControls.onMaximizeChange(setMaximized);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="drag-region flex h-9 shrink-0 items-center justify-end border-b bg-card select-none">
      <WindowControlButton
        icon={Minus}
        label="最小化"
        onClick={() => window.windowControls.minimize()}
      />
      <WindowControlButton
        icon={maximized ? Copy : Square}
        label={maximized ? "向下还原" : "最大化"}
        onClick={() => window.windowControls.toggleMaximize()}
      />
      <WindowControlButton
        icon={X}
        label="关闭"
        danger
        onClick={() => window.windowControls.close()}
      />
    </div>
  );
}
