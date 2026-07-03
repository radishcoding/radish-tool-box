import { X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { KeyValueItem } from "../model/types";

/**
 * 生成一个空变量项.
 */
function emptyVar(): KeyValueItem {
  return {
    id: `var-${crypto.randomUUID()}`,
    key: "",
    value: "",
    enabled: true,
  };
}

/**
 * 变量表: 启用勾选 + 键 + 值 + secret 标记 (掩码) + 删除.
 * @param items 变量项.
 * @param onChange 整表变更回调.
 */
export function VariableTable({
  items,
  onChange,
}: {
  readonly items: readonly KeyValueItem[];
  readonly onChange: (items: readonly KeyValueItem[]) => void;
}): ReactElement {
  const patch = (id: string, partial: Partial<KeyValueItem>): void => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...partial } : it)));
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
            aria-label="启用此变量"
          />
          <Input
            value={item.key}
            placeholder="变量名"
            spellCheck={false}
            onChange={(e) => patch(item.id, { key: e.target.value })}
            className={cn(
              "h-7 flex-1 font-mono text-xs",
              !item.enabled && "opacity-50",
            )}
          />
          <Input
            value={item.value}
            placeholder="值"
            type={item.kind === "secret" ? "password" : "text"}
            spellCheck={false}
            onChange={(e) => patch(item.id, { value: e.target.value })}
            className={cn(
              "h-7 flex-1 font-mono text-xs",
              !item.enabled && "opacity-50",
            )}
          />
          <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              aria-label="标记为密码变量"
              checked={item.kind === "secret"}
              onChange={(e) =>
                patch(item.id, { kind: e.target.checked ? "secret" : "text" })
              }
              className="size-3 cursor-pointer accent-primary"
            />
            密
          </label>
          <button
            type="button"
            aria-label="删除此变量"
            onClick={() => onChange(items.filter((it) => it.id !== item.id))}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...items, emptyVar()])}
        className="h-7 w-fit cursor-pointer text-xs text-muted-foreground"
      >
        添加变量
      </Button>
    </div>
  );
}
