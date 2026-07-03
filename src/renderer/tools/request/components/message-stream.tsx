import { useEffect, useRef, type ReactElement } from "react";

import { cn } from "@/lib/utils";

import type { Message } from "../model/types";

/**
 * 方向标签文案.
 * @param direction 消息方向.
 * @returns 对应文案.
 */
function dirLabel(direction: Message["direction"]): string {
  return direction === "sent"
    ? "发送"
    : direction === "received"
      ? "接收"
      : "系统";
}

/**
 * 把时间戳格式化为 HH:MM:SS.
 * @param ms 毫秒时间戳.
 * @returns 时分秒字符串.
 */
function fmtTime(ms: number): string {
  return new Date(ms).toTimeString().slice(0, 8);
}

/**
 * 计算消息内容的 UTF-8 字节数 (驱动未提供 size 时的兜底).
 * @param data 消息文本.
 * @returns 字节数.
 */
function byteSize(data: string): number {
  return new TextEncoder().encode(data).length;
}

/**
 * 消息流: 双向消息列表 (发送靠右, 接收靠左, 系统居中).
 * 新消息到达时自动滚动到底部.
 * @param messages 消息列表.
 */
export function MessageStream({
  messages,
}: {
  readonly messages: readonly Message[];
}): ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        暂无消息
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 p-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "flex flex-col gap-0.5",
            m.direction === "sent"
              ? "items-end"
              : m.direction === "received"
                ? "items-start"
                : "items-center",
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {dirLabel(m.direction)} · {fmtTime(m.time)}
            {m.event !== "" ? ` · ${m.event}` : ""}
            {` · ${m.size ?? byteSize(m.data)} B`}
          </span>
          <pre
            className={cn(
              "max-w-[80%] whitespace-pre-wrap rounded px-2 py-1 font-mono text-xs",
              m.direction === "sent"
                ? "bg-primary/10 text-primary"
                : m.direction === "system"
                  ? "bg-muted/50 italic text-muted-foreground"
                  : "bg-muted text-foreground",
            )}
          >
            {m.data}
          </pre>
        </div>
      ))}
      {/* 滚动锚点 */}
      <div ref={bottomRef} />
    </div>
  );
}
