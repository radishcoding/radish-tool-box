import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { sortByLength } from "@/lib/sort-by-length";
import { cn } from "@/lib/utils";

import { CODEC_GROUPS, CODECS } from "../model/registry";
import { useCodecStore } from "../store/codec-store";

/**
 * 编码解码工具左侧分组导航.
 * 按族 (CodecGroup) 聚合列出全部编解码项, 激活项高亮与 crypto-sidebar 一致.
 */
export function CodecSidebar(): ReactElement {
  const codecId = useCodecStore((s) => s.codecId);
  const setCodecId = useCodecStore((s) => s.setCodecId);

  return (
    <nav className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-muted/30 p-2">
      {CODEC_GROUPS.map((group) => {
        const items = sortByLength(
          CODECS.filter((c) => c.group === group.id),
          (c) => c.label,
        );
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={group.id} className="flex flex-col gap-0.5">
            <span className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {group.label}
            </span>
            {items.map((codec) => {
              const active = codec.id === codecId;
              return (
                <Button
                  key={codec.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCodecId(codec.id)}
                  className={cn(
                    "cursor-pointer justify-start text-muted-foreground",
                    active &&
                      "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                  )}
                >
                  {codec.label}
                </Button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
