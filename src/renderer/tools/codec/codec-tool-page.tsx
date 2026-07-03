import type { ReactElement } from "react";

import { CodecSidebar } from "./components/codec-sidebar";
import { CodecWorkspace } from "./components/codec-workspace";

/**
 * 编码解码工具页: 左分组导航 + 右工作区, 布局与算法调试页完全一致.
 */
export function CodecToolPage(): ReactElement {
  return (
    <div className="flex h-full min-h-0">
      <CodecSidebar />
      <CodecWorkspace />
    </div>
  );
}
