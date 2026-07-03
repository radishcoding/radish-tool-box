import type { ReactElement } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import type { Message, RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { ConnectionEditor } from "./connection-editor";
import { GrpcEditor } from "./grpc-editor";
import { MessageStream } from "./message-stream";

/**
 * 稳定的空消息数组: 尚无连接时选择器返回它, 避免每次渲染产生新引用触发无限循环.
 */
const EMPTY_MESSAGES: readonly Message[] = [];

/**
 * 连接工作区 (WS/SocketIO/SSE/TCP/MQTT/gRPC): 上连接配置 + 下消息流.
 * gRPC 协议渲染 GrpcEditor; 其它协议渲染 ConnectionEditor; 下半消息流共用.
 * @param tab 当前标签.
 */
export function ConnectionWorkspace({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const messages = useRequestStore(
    (s) => s.connections[tab.id]?.messages ?? EMPTY_MESSAGES,
  );
  return (
    <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
      <ResizablePanel defaultSize="40%" minSize="20%">
        <div className="h-full overflow-auto border-b">
          {tab.protocol === "grpc" ? (
            <GrpcEditor tab={tab} />
          ) : (
            <ConnectionEditor tab={tab} />
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize="60%" minSize="20%">
        <div className="h-full overflow-auto">
          <MessageStream messages={messages} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
