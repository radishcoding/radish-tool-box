import type { ReactElement } from "react";

import { CryptoSidebar } from "./components/crypto-sidebar";
import { CryptoWorkspace } from "./components/crypto-workspace";

/**
 * 算法调试工具页: 左分类导航 + 右工作区.
 */
export function CryptoToolPage(): ReactElement {
  return (
    <div className="flex h-full min-h-0">
      <CryptoSidebar />
      <CryptoWorkspace />
    </div>
  );
}
