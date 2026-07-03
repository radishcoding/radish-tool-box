import type { ReactElement } from "react";

import { EncodingWorkspace } from "./components/encoding-workspace";

/**
 * 编码转换工具页.
 */
export function EncodingToolPage(): ReactElement {
  return (
    <div className="h-full min-h-0 p-3">
      <EncodingWorkspace />
    </div>
  );
}
