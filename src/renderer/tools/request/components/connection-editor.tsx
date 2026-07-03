import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  connect,
  disconnect,
  sendMessage,
} from "@/hooks/use-request-execution";
import type { ConnectionConfig, RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { ConnectionConfigPanel } from "./connection-config";

/** MQTT QoS 级别. */
type MqttQos = 0 | 1 | 2;

/**
 * 取标签当前协议的 URL (tcp 协议返回空串).
 * @param tab 标签.
 * @returns URL.
 */
function urlOf(tab: RequestTab): string {
  return tab.protocol === "websocket"
    ? (tab.ws?.url ?? "")
    : tab.protocol === "socketio"
      ? (tab.socketio?.url ?? "")
      : tab.protocol === "sse"
        ? (tab.sse?.url ?? "")
        : tab.protocol === "mqtt"
          ? (tab.mqtt?.url ?? "")
          : "";
}

/**
 * 把标签的连接配置组装为 ConnectionConfig.
 * @param tab 标签.
 * @returns 连接配置, 或 undefined (协议不符).
 */
function configOf(tab: RequestTab): ConnectionConfig | undefined {
  if (tab.protocol === "websocket" && tab.ws !== undefined) {
    return { protocol: "websocket", ws: tab.ws };
  }
  if (tab.protocol === "socketio" && tab.socketio !== undefined) {
    return { protocol: "socketio", socketio: tab.socketio };
  }
  if (tab.protocol === "sse" && tab.sse !== undefined) {
    return { protocol: "sse", sse: tab.sse };
  }
  if (tab.protocol === "tcp" && tab.tcp !== undefined) {
    return { protocol: "tcp", tcp: tab.tcp };
  }
  if (tab.protocol === "mqtt" && tab.mqtt !== undefined) {
    return { protocol: "mqtt", mqtt: tab.mqtt };
  }
  return undefined;
}

/**
 * 判断标签当前输入是否满足连接所需最小条件.
 * @param tab 标签.
 * @returns 可连接时返回 true.
 */
function canConnect(tab: RequestTab): boolean {
  if (tab.protocol === "tcp") {
    return (tab.tcp?.host ?? "") !== "" && (tab.tcp?.port ?? 0) > 0;
  }
  return urlOf(tab) !== "";
}

/**
 * 连接编辑区: 地址 + 连接/断开 + (WS/SocketIO/TCP/MQTT) 发送框.
 * @param tab 当前标签.
 */
export function ConnectionEditor({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateConnectionUrl = useRequestStore((s) => s.updateConnectionUrl);
  const updateMqttConfig = useRequestStore((s) => s.updateMqttConfig);
  const updateTcpConfig = useRequestStore((s) => s.updateTcpConfig);
  const connection = useRequestStore((s) => s.connections[tab.id]);
  const clearMessages = useRequestStore((s) => s.clearMessages);
  const [draft, setDraft] = useState("");
  const [eventName, setEventName] = useState("message");
  const [sendFormat, setSendFormat] = useState<"text" | "hex">("text");
  const [pubTopic, setPubTopic] = useState("");
  const [pubQos, setPubQos] = useState<MqttQos>(0);

  const status = connection?.status ?? "idle";
  const isOpen = status === "open";
  const canSend = isOpen && tab.protocol !== "sse";

  return (
    <div className="flex flex-col">
      {/* 地址行 */}
      <div className="flex items-center gap-2 px-3 pt-3">
        {tab.protocol === "tcp" ? (
          <>
            <Input
              value={tab.tcp?.host ?? ""}
              placeholder="主机 (如 127.0.0.1)"
              spellCheck={false}
              onChange={(e) => {
                updateTcpConfig(tab.id, { host: e.target.value });
              }}
              className="h-8 flex-1 font-mono text-xs"
            />
            <Input
              type="number"
              value={tab.tcp?.port === 0 ? "" : (tab.tcp?.port ?? "")}
              placeholder="端口"
              onChange={(e) => {
                updateTcpConfig(tab.id, { port: Number(e.target.value) || 0 });
              }}
              className="h-8 w-24 font-mono text-xs"
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={tab.tcp?.tls ?? false}
                onChange={(e) => {
                  updateTcpConfig(tab.id, { tls: e.target.checked });
                }}
                className="size-3.5 cursor-pointer accent-primary"
              />
              TLS
            </label>
          </>
        ) : (
          <Input
            value={urlOf(tab)}
            placeholder={
              tab.protocol === "websocket"
                ? "ws://example.com/socket"
                : tab.protocol === "socketio"
                  ? "http://example.com"
                  : tab.protocol === "mqtt"
                    ? "mqtt://broker:1883"
                    : "https://example.com/events"
            }
            spellCheck={false}
            onChange={(e) => {
              if (tab.protocol === "mqtt") {
                updateMqttConfig(tab.id, { url: e.target.value });
              } else {
                updateConnectionUrl(tab.id, e.target.value);
              }
            }}
            className="h-8 flex-1 font-mono text-xs"
          />
        )}
        {isOpen || status === "connecting" ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-20 cursor-pointer"
            onClick={() => {
              disconnect(tab.id);
            }}
          >
            断开
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 w-20 cursor-pointer"
            disabled={!canConnect(tab)}
            onClick={() => {
              const config = configOf(tab);
              if (config !== undefined) {
                connect(tab.id, config);
              }
            }}
          >
            连接
          </Button>
        )}
      </div>

      {/* 状态行 */}
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        {/* 状态色点 */}
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            status === "open"
              ? "bg-emerald-500"
              : status === "connecting"
                ? "animate-pulse bg-amber-400"
                : status === "error"
                  ? "bg-destructive"
                  : "bg-muted-foreground/40",
          )}
        />
        <span
          className={
            status === "open"
              ? "font-medium text-emerald-600 dark:text-emerald-400"
              : status === "connecting"
                ? "text-amber-600 dark:text-amber-400"
                : status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
          }
        >
          {status === "open"
            ? "已连接"
            : status === "connecting"
              ? "连接中..."
              : status === "closed"
                ? "已关闭"
                : status === "error"
                  ? "错误"
                  : "未连接"}
        </span>
        {connection?.error !== undefined && connection.error !== "" && (
          <span className="truncate text-destructive">{connection.error}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 cursor-pointer px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            clearMessages(tab.id);
          }}
        >
          清空消息
        </Button>
      </div>

      {/* 连接配置区 (含 TLS/高级设置; TCP 无应用层头但仍需 TLS 设置) */}
      <ConnectionConfigPanel tab={tab} />

      {/* 发送行 (SSE 只收, 不显示) */}
      {tab.protocol !== "sse" && (
        <div className="flex items-center gap-2 px-3 py-2">
          {tab.protocol === "socketio" && (
            <Input
              value={eventName}
              placeholder="事件名"
              spellCheck={false}
              onChange={(e) => {
                setEventName(e.target.value);
              }}
              className="h-8 w-32 shrink-0 font-mono text-xs"
            />
          )}
          {tab.protocol === "tcp" && (
            <select
              value={sendFormat}
              onChange={(e) => {
                setSendFormat(e.target.value === "hex" ? "hex" : "text");
              }}
              className="h-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent px-2 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              aria-label="发送格式"
            >
              <option value="text">文本</option>
              <option value="hex">Hex</option>
            </select>
          )}
          {tab.protocol === "mqtt" && (
            <>
              <Input
                value={pubTopic}
                placeholder="发布主题"
                spellCheck={false}
                onChange={(e) => {
                  setPubTopic(e.target.value);
                }}
                className="h-8 w-40 shrink-0 font-mono text-xs"
              />
              <select
                value={String(pubQos)}
                onChange={(e) => {
                  setPubQos((Number(e.target.value) || 0) as MqttQos);
                }}
                className="h-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent px-2 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                aria-label="QoS"
              >
                <option value="0">QoS 0</option>
                <option value="1">QoS 1</option>
                <option value="2">QoS 2</option>
              </select>
            </>
          )}
          <Input
            value={draft}
            placeholder={
              tab.protocol === "socketio"
                ? "消息内容 (JSON)"
                : tab.protocol === "tcp" && sendFormat === "hex"
                  ? "Hex (如 48 65 6c 6c 6f)"
                  : "消息内容"
            }
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                canSend &&
                draft !== "" &&
                !(tab.protocol === "mqtt" && pubTopic === "")
              ) {
                sendMessage(tab.id, {
                  event:
                    tab.protocol === "socketio"
                      ? eventName
                      : tab.protocol === "mqtt"
                        ? pubTopic
                        : "",
                  data: draft,
                  format: tab.protocol === "tcp" ? sendFormat : undefined,
                  qos: tab.protocol === "mqtt" ? pubQos : undefined,
                });
                setDraft("");
              }
            }}
            className="h-8 flex-1 font-mono text-xs"
          />
          <Button
            size="sm"
            className="h-8 w-20 cursor-pointer"
            disabled={
              !canSend ||
              draft === "" ||
              (tab.protocol === "mqtt" && pubTopic === "")
            }
            onClick={() => {
              sendMessage(tab.id, {
                event:
                  tab.protocol === "socketio"
                    ? eventName
                    : tab.protocol === "mqtt"
                      ? pubTopic
                      : "",
                data: draft,
                format: tab.protocol === "tcp" ? sendFormat : undefined,
                qos: tab.protocol === "mqtt" ? pubQos : undefined,
              });
              setDraft("");
            }}
          >
            发送
          </Button>
        </div>
      )}
    </div>
  );
}
