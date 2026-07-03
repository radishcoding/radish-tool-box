import { ChevronDown, Plus, X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { disconnect } from "@/hooks/use-request-execution";
import { useRequestStore } from "../store/request-store";
import { EnvironmentSwitcher } from "./environment-switcher";

/**
 * 关闭标签前拆除其底层资源: HTTP 请求进行中则取消, 连接处于 connecting/open 则断开.
 * 即时读取 store, 避免订阅整个连接/响应表导致标签栏随消息重渲.
 * @param tabId 目标标签 id.
 */
function teardownTab(tabId: string): void {
  const state = useRequestStore.getState();
  const response = state.responses[tabId];
  if (response?.phase === "running") {
    window.networkApi.cancel(response.jobId);
  }
  const conn = state.connections[tabId];
  if (conn?.status === "connecting" || conn?.status === "open") {
    disconnect(tabId);
  }
}

/**
 * 多请求标签栏: 列出打开的请求, 高亮活动项, 支持关闭与新建.
 * 新建按钮为协议下拉菜单 (HTTP/WebSocket/Socket.IO/SSE/TCP/MQTT/gRPC).
 * 关闭标签 (含关闭其它/全部) 时先断开连接/取消请求, 再移除标签, 不留残留.
 * 每个标签支持右键菜单: 关闭标签, 关闭其它标签, 关闭全部标签.
 */
export function RequestTabs(): ReactElement {
  const tabs = useRequestStore((s) => s.tabs);
  const activeTabId = useRequestStore((s) => s.activeTabId);
  const selectTab = useRequestStore((s) => s.selectTab);
  const closeTab = useRequestStore((s) => s.closeTab);
  const closeOtherTabs = useRequestStore((s) => s.closeOtherTabs);
  const closeAllTabs = useRequestStore((s) => s.closeAllTabs);
  const newTab = useRequestStore((s) => s.newTab);
  const newProtocolTab = useRequestStore((s) => s.newProtocolTab);

  /**
   * 关闭单个标签: 先拆资源再移除.
   * @param tabId 目标标签 id.
   */
  const handleClose = (tabId: string): void => {
    teardownTab(tabId);
    closeTab(tabId);
  };

  /**
   * 关闭除保留项外的其它全部标签: 逐一拆资源后批量移除.
   * @param keepId 保留的标签 id.
   */
  const handleCloseOthers = (keepId: string): void => {
    for (const t of useRequestStore.getState().tabs) {
      if (t.id !== keepId) {
        teardownTab(t.id);
      }
    }
    closeOtherTabs(keepId);
  };

  /** 关闭全部标签: 逐一拆资源后清空. */
  const handleCloseAll = (): void => {
    for (const t of useRequestStore.getState().tabs) {
      teardownTab(t.id);
    }
    closeAllTabs();
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectTab(tab.id);
                  }
                }}
                className={cn(
                  "group flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors",
                  active
                    ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    : "hover:bg-muted hover:text-foreground",
                )}
              >
                {/* HTTP 显示方法标识; 协议标签显示色点 */}
                {tab.protocol === "http" ? (
                  <span className="font-mono text-[10px] opacity-70">
                    {tab.request.method}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      tab.protocol === "websocket"
                        ? "bg-blue-500"
                        : tab.protocol === "socketio"
                          ? "bg-amber-500"
                          : tab.protocol === "tcp"
                            ? "bg-rose-500"
                            : tab.protocol === "mqtt"
                              ? "bg-violet-500"
                              : tab.protocol === "grpc"
                                ? "bg-cyan-500"
                                : "bg-emerald-500",
                    )}
                  />
                )}
                <span className="max-w-32 truncate">{tab.name}</span>
                {tab.dirty && (
                  <span className="size-1.5 rounded-full bg-current opacity-60" />
                )}
                <button
                  type="button"
                  aria-label="关闭标签"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose(tab.id);
                  }}
                  className="flex size-4 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-36">
              <ContextMenuItem
                className="cursor-pointer text-xs"
                onClick={() => handleClose(tab.id)}
              >
                关闭标签
              </ContextMenuItem>
              <ContextMenuItem
                className="cursor-pointer text-xs"
                disabled={tabs.length <= 1}
                onClick={() => handleCloseOthers(tab.id)}
              >
                关闭其它标签
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="cursor-pointer text-xs"
                onClick={handleCloseAll}
              >
                关闭全部标签
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="新建标签"
            className="flex h-6 shrink-0 cursor-pointer items-center gap-0.5 rounded px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newTab();
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            HTTP
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newProtocolTab("websocket");
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
            WebSocket
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newProtocolTab("socketio");
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
            Socket.IO
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newProtocolTab("sse");
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
            SSE
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newProtocolTab("tcp");
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />
            TCP
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newProtocolTab("mqtt");
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-violet-500" />
            MQTT
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs"
            onClick={() => {
              newProtocolTab("grpc");
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-cyan-500" />
            gRPC
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto pr-1">
        <EnvironmentSwitcher />
      </div>
    </div>
  );
}
