import type { ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHARSETS } from "@/lib/charset/charsets";
import { sortByLength } from "@/lib/sort-by-length";

/**
 * 按 group 聚合后的字符集, 保持注册表顺序.
 */
const GROUPED = CHARSETS.reduce<Map<string, (typeof CHARSETS)[number][]>>(
  (map, charset) => {
    const list = map.get(charset.group) ?? [];
    list.push(charset);
    map.set(charset.group, list);
    return map;
  },
  new Map(),
);

/**
 * 分组字符集下拉.
 * @param value 当前字符集 id.
 * @param onChange 选择回调.
 */
export function CharsetSelect({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (id: string) => void;
}): ReactElement {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from(GROUPED.entries()).map(([group, items]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {sortByLength(items, (c) => c.label).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
