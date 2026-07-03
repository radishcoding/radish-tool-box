import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CodecChoiceOption } from "../model/types";

/**
 * 渲染当前 codec 的专属下拉选项组.
 * 每个选项渲染为 label + Select 控件, 与 encoding-toolbar 样式对齐.
 * @param options 选项声明列表.
 * @param values 当前各选项的值 (按 optionId).
 * @param onChange 选项变更回调.
 */
export function CodecOptions({
  options,
  values,
  onChange,
}: {
  readonly options: readonly CodecChoiceOption[];
  readonly values: Readonly<Record<string, string>>;
  readonly onChange: (optionId: string, value: string) => void;
}): ReactElement {
  return (
    <>
      {options.map((option) => (
        <label
          key={option.id}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {option.label}
          {option.kind === "text" ? (
            <Input
              value={values[option.id] ?? option.defaultValue}
              onChange={(e) => onChange(option.id, e.target.value)}
              placeholder={option.placeholder}
              spellCheck={false}
              className="h-7 w-44 font-mono text-xs"
            />
          ) : (
            <Select
              value={values[option.id] ?? option.defaultValue}
              onValueChange={(v) => onChange(option.id, v)}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(option.choices ?? []).map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>
      ))}
    </>
  );
}
