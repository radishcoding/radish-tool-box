import { FolderOpen } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { FileFilter } from "../../../../ipc-channels";

/**
 * 文件路径输入: 一个可手填的路径框 + 一个弹原生文件选择框的浏览按钮.
 * @param value 当前路径.
 * @param onChange 路径变更回调.
 * @param placeholder 占位文本.
 * @param filters 文件选择框的类型过滤器.
 */
export function FilePathInput({
  value,
  onChange,
  placeholder,
  filters,
}: {
  readonly value: string;
  readonly onChange: (path: string) => void;
  readonly placeholder?: string;
  readonly filters?: readonly FileFilter[];
}): ReactElement {
  const browse = (): void => {
    void window.fileApi.openPath(filters).then((picked) => {
      if (picked !== undefined) {
        onChange(picked);
      }
    });
  };
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <Input
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-7 flex-1 font-mono text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="浏览文件"
        onClick={browse}
        className="h-7 shrink-0 cursor-pointer px-2"
      >
        <FolderOpen className="size-3.5" />
      </Button>
    </div>
  );
}
