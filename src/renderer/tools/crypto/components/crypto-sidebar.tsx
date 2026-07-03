import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useCryptoStore } from "../store/crypto-store";
import { CATEGORY_ITEMS } from "./category-items";

/**
 * 算法调试工具左侧分类导航.
 */
export function CryptoSidebar(): ReactElement {
  const activeCategory = useCryptoStore((state) => state.activeCategory);
  const setActiveCategory = useCryptoStore((state) => state.setActiveCategory);

  return (
    <nav className="flex w-44 shrink-0 flex-col gap-1 border-r bg-muted/30 p-2">
      <span className="px-2 py-1 text-xs font-medium text-muted-foreground">
        算法分类
      </span>
      {CATEGORY_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeCategory;
        return (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory(item.id)}
            className={cn(
              "cursor-pointer justify-start gap-2 text-muted-foreground",
              active &&
                "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
