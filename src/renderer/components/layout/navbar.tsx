import { Carrot } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOOLS } from "@/tools/registry";

/**
 * 顶部导航栏: 品牌 + 工具切换.
 */
export function Navbar({
  activeToolId,
  onSelect,
}: {
  readonly activeToolId: string;
  readonly onSelect: (id: string) => void;
}): ReactElement {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b bg-card px-4">
      <div className="mr-4 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Carrot className="size-5" />
        </span>
        <span className="font-display text-lg text-foreground">萝卜工具箱</span>
      </div>
      <nav className="flex items-center gap-1">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = tool.id === activeToolId;
          return (
            <Button
              key={tool.id}
              variant="ghost"
              size="sm"
              onClick={() => onSelect(tool.id)}
              className={cn(
                "cursor-pointer gap-2 text-muted-foreground",
                active &&
                  "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
              )}
            >
              <Icon className="size-4" />
              {tool.label}
            </Button>
          );
        })}
      </nav>
    </header>
  );
}
