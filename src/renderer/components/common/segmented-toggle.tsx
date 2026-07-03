import type { ReactElement, ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * 分段选项.
 */
export interface SegmentedOption {
  readonly value: string;
  readonly label: ReactNode;
}

/**
 * 带滑动指示器的分段切换控件.
 *
 * 在 shadcn ToggleGroup 之上叠加一个平滑滑动的高亮块: 选中态由滑块表达,
 * 切换时滑块按索引平滑移动到目标项 (选项等宽); 自动尊重 prefers-reduced-motion.
 * @param options 选项列表, 等宽排列.
 * @param value 当前选中值.
 * @param onChange 选中变化回调.
 * @param className 附加在外层轨道上的类名.
 */
export function SegmentedToggle({
  options,
  value,
  onChange,
  className,
}: {
  readonly options: readonly SegmentedOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
}): ReactElement {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      className={cn(
        "relative inline-flex items-stretch rounded-md border bg-muted/60 p-0.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-sm bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.25rem) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          if (next) {
            onChange(next);
          }
        }}
        size="sm"
        className="relative z-10 w-full gap-0"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-7 min-w-0 flex-1 cursor-pointer rounded-sm bg-transparent px-3 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
