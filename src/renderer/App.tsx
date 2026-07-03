import type { ReactElement } from "react";

import { AppShell } from "@/components/layout/app-shell";

/**
 * 应用根组件, 渲染整体外壳.
 */
export function App(): ReactElement {
  return <AppShell />;
}
