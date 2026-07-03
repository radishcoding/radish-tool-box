import type { ReactElement } from "react";

import type { RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { KeyValueTable } from "./key-value-table";

/**
 * Params 子页: 编辑查询参数 (发送时并入 URL).
 * @param tab 当前标签.
 */
export function EditorParams({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  return (
    <div className="p-3">
      <KeyValueTable
        items={tab.request.params}
        onChange={(params) => updateRequest(tab.id, { params })}
        keyPlaceholder="参数名"
        valuePlaceholder="参数值"
      />
    </div>
  );
}
