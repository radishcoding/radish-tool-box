import type { ReactElement } from "react";

import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { HexFormat, HexOptions } from "../model/types";

/**
 * Hex 显示格式选项列表.
 */
const FORMAT_OPTIONS: ReadonlyArray<{
  readonly value: HexFormat;
  readonly label: string;
}> = [
  { value: "none", label: "无" },
  { value: "space", label: "空格" },
  { value: "dash", label: "连字符" },
  { value: "array-hex", label: "0x 数组" },
  { value: "array-dec", label: "十进制数组" },
];

/**
 * 顶部条: 严格模式开关 + Hex 大小写/显示格式选项.
 * @param strict 严格模式是否开启.
 * @param hex 当前 Hex 选项.
 * @param onStrictChange 严格模式变更回调.
 * @param onHexChange Hex 选项部分更新回调.
 */
export function EncodingToolbar({
  strict,
  hex,
  onStrictChange,
  onHexChange,
}: {
  readonly strict: boolean;
  readonly hex: HexOptions;
  readonly onStrictChange: (value: boolean) => void;
  readonly onHexChange: (patch: Partial<HexOptions>) => void;
}): ReactElement {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b px-2.5">
      <span className="text-sm font-medium text-muted-foreground">
        编码转换
      </span>
      <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <Switch checked={strict} onCheckedChange={onStrictChange} />
        严格模式
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Switch
          checked={hex.upperCase}
          onCheckedChange={(v) => onHexChange({ upperCase: v })}
        />
        Hex 大写
      </label>
      <Select
        value={hex.format}
        onValueChange={(v) => onHexChange({ format: v as HexFormat })}
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
