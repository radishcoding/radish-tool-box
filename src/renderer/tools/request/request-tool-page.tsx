import type { ReactElement } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { ConnectionWorkspace } from "./components/connection-workspace";
import { HttpEditor } from "./components/http-editor";
import { RequestEmptyState } from "./components/request-empty-state";
import { RequestSidebar } from "./components/request-sidebar";
import { RequestTabs } from "./components/request-tabs";
import { ResponsePanel } from "./components/response-panel";
import { useRequestStore } from "./store/request-store";

/**
 * 请求调试工具页: 三栏外壳 (左侧栏 + 标签栏 + 编辑区/响应区上下分栏).
 * HTTP 协议走既有编辑器+响应区; WS/SocketIO/SSE 走连接工作区.
 */
export function RequestToolPage(): ReactElement {
  const tabs = useRequestStore((s) => s.tabs);
  const activeTabId = useRequestStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const response = useRequestStore((s) =>
    activeTabId === undefined ? undefined : s.responses[activeTabId],
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize="20%" minSize="14%" maxSize="32%">
        <RequestSidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize="80%">
        <div className="flex h-full min-h-0 flex-col">
          <RequestTabs />
          {activeTab === undefined ? (
            <RequestEmptyState />
          ) : activeTab.protocol === "http" ? (
            <ResizablePanelGroup
              orientation="vertical"
              className="min-h-0 flex-1"
            >
              <ResizablePanel defaultSize="55%" minSize="25%">
                <HttpEditor tab={activeTab} />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="45%" minSize="20%">
                <ResponsePanel response={response} />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <ConnectionWorkspace tab={activeTab} />
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
