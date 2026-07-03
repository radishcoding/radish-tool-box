import type { ComponentType, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * 带 Tooltip 的图标按钮, 工具栏与面板头部复用; active 表示切换类按钮的激活态.
 */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  readonly onClick?: () => void;
  readonly active?: boolean;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "cursor-pointer text-muted-foreground",
            active &&
              "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          )}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
