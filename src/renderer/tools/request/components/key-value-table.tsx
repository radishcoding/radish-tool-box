import { Plus, X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { KeyValueItem } from "../model/types";

/**
 * 生成一个空键值项.
 */
function emptyItem(): KeyValueItem {
  return { id: `kv-${crypto.randomUUID()}`, key: "", value: "", enabled: true };
}

/**
 * 受控键值表: 启用勾选 + 键 + 值 + 删除, 末尾常驻一行新增按钮.
 * @param items 当前键值项.
 * @param onChange 整表变更回调.
 * @param keyPlaceholder 键输入占位.
 * @param valuePlaceholder 值输入占位.
 */
export function KeyValueTable({
  items,
  onChange,
  keyPlaceholder = "键",
  valuePlaceholder = "值",
}: {
  readonly items: readonly KeyValueItem[];
  readonly onChange: (items: readonly KeyValueItem[]) => void;
  readonly keyPlaceholder?: string;
  readonly valuePlaceholder?: string;
}): ReactElement {
  const patch = (id: string, partial: Partial<KeyValueItem>): void => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  };
  const remove = (id: string): void => {
    onChange(items.filter((it) => it.id !== id));
  };
  const add = (): void => {
    onChange([...items, emptyItem()]);
  };

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => patch(item.id, { enabled: e.target.checked })}
            className="size-3.5 cursor-pointer accent-primary"
            aria-label="启用此项"
          />
          <Input
            value={item.key}
            placeholder={keyPlaceholder}
            spellCheck={false}
            onChange={(e) => patch(item.id, { key: e.target.value })}
            className={cn(
              "h-7 flex-1 font-mono text-xs",
              !item.enabled && "opacity-50",
            )}
          />
          <Input
            value={item.value}
            placeholder={valuePlaceholder}
            spellCheck={false}
            onChange={(e) => patch(item.id, { value: e.target.value })}
            className={cn(
              "h-7 flex-1 font-mono text-xs",
              !item.enabled && "opacity-50",
            )}
          />
          <button
            type="button"
            aria-label="删除此项"
            onClick={() => remove(item.id)}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        className="h-7 w-fit cursor-pointer gap-1 text-xs text-muted-foreground"
      >
        <Plus className="size-3.5" />
        添加
      </Button>
    </div>
  );
}
