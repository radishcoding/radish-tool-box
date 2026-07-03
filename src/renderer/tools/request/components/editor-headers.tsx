import type { ReactElement } from "react";

import { Switch } from "@/components/ui/switch";

import type { RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { KeyValueTable } from "./key-value-table";

/**
 * Headers 子页: 编辑请求头 + 洁净模式开关.
 * @param tab 当前标签.
 */
export function EditorHeaders({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch
          checked={tab.request.cleanMode}
          onCheckedChange={(cleanMode) => updateRequest(tab.id, { cleanMode })}
        />
        洁净模式 (不附加任何自动头, 只发以下头)
      </label>
      <KeyValueTable
        items={tab.request.headers}
        onChange={(headers) => updateRequest(tab.id, { headers })}
        keyPlaceholder="头名"
        valuePlaceholder="头值"
      />
    </div>
  );
}
