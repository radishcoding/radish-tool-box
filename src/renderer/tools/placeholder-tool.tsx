import { Hammer } from "lucide-react";
import type { ReactElement } from "react";

/**
 * 未实现工具的占位页.
 */
export function PlaceholderTool({
  name,
}: {
  readonly name: string;
}): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Hammer className="size-10 opacity-40" />
      <p className="text-sm">{name} - 敬请期待</p>
    </div>
  );
}
