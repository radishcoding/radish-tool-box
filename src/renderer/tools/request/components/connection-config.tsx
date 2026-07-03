import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { MqttSubscription, RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { KeyValueTable } from "./key-value-table";
import { TlsSettingsFields } from "./tls-settings-fields";

/**
 * MQTT 订阅列表编辑器: 每行主题 + QoS, 末尾常驻添加按钮.
 * @param subscriptions 当前订阅列表.
 * @param onChange 整表变更回调.
 */
function MqttSubscriptionList({
  subscriptions,
  onChange,
}: {
  readonly subscriptions: readonly MqttSubscription[];
  readonly onChange: (subscriptions: readonly MqttSubscription[]) => void;
}): ReactElement {
  const patch = (index: number, next: Partial<MqttSubscription>): void => {
    onChange(
      subscriptions.map((s, i) => (i === index ? { ...s, ...next } : s)),
    );
  };
  const remove = (index: number): void => {
    onChange(subscriptions.filter((_, i) => i !== index));
  };
  const add = (): void => {
    onChange([...subscriptions, { topic: "", qos: 0 }]);
  };
  return (
    <div className="flex flex-col gap-1">
      {subscriptions.map((sub, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            value={sub.topic}
            placeholder="主题 (如 dev/+/temp)"
            spellCheck={false}
            onChange={(e) => {
              patch(index, { topic: e.target.value });
            }}
            className="h-7 flex-1 font-mono text-xs"
          />
          <select
            value={String(sub.qos)}
            onChange={(e) => {
              patch(index, { qos: (Number(e.target.value) || 0) as 0 | 1 | 2 });
            }}
            className="h-7 shrink-0 cursor-pointer rounded-md border border-input bg-transparent px-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            aria-label="QoS"
          >
            <option value="0">Q0</option>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
          </select>
          <button
            type="button"
            aria-label="删除订阅"
            onClick={() => {
              remove(index);
            }}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        className="h-7 w-fit cursor-pointer gap-1 text-xs text-muted-foreground"
      >
        <Plus className="size-3.5" />
        添加订阅
      </Button>
    </div>
  );
}

/**
 * 连接配置区 (可折叠): 请求头 + (WS) 子协议 + (SocketIO) 命名空间 + (MQTT) broker 凭据与订阅.
 * @param tab 当前协议标签.
 */
export function ConnectionConfigPanel({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const updateConnectionHeaders = useRequestStore(
    (s) => s.updateConnectionHeaders,
  );
  const updateWsSubprotocols = useRequestStore((s) => s.updateWsSubprotocols);
  const updateSocketIoNamespace = useRequestStore(
    (s) => s.updateSocketIoNamespace,
  );
  const updateMqttConfig = useRequestStore((s) => s.updateMqttConfig);
  const updateMqttSubscriptions = useRequestStore(
    (s) => s.updateMqttSubscriptions,
  );
  const updateConnectionSettings = useRequestStore(
    (s) => s.updateConnectionSettings,
  );

  // 当前协议配置的 settings (仅其一非空); 用于 TLS/超时等高级设置.
  const settings =
    tab.ws?.settings ??
    tab.socketio?.settings ??
    tab.sse?.settings ??
    tab.tcp?.settings ??
    tab.mqtt?.settings ??
    tab.grpc?.settings;

  const headers =
    tab.protocol === "websocket"
      ? (tab.ws?.headers ?? [])
      : tab.protocol === "socketio"
        ? (tab.socketio?.headers ?? [])
        : tab.protocol === "sse"
          ? (tab.sse?.headers ?? [])
          : [];

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        连接配置
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3 pt-0.5">
          {tab.protocol === "mqtt" ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Client ID
                <Input
                  value={tab.mqtt?.clientId ?? ""}
                  placeholder="留空自动生成"
                  spellCheck={false}
                  onChange={(e) => {
                    updateMqttConfig(tab.id, { clientId: e.target.value });
                  }}
                  className="h-7 font-mono text-xs text-foreground"
                />
              </label>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  用户名
                  <Input
                    value={tab.mqtt?.username ?? ""}
                    spellCheck={false}
                    onChange={(e) => {
                      updateMqttConfig(tab.id, { username: e.target.value });
                    }}
                    className="h-7 font-mono text-xs text-foreground"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  密码
                  <Input
                    type="password"
                    value={tab.mqtt?.password ?? ""}
                    spellCheck={false}
                    onChange={(e) => {
                      updateMqttConfig(tab.id, { password: e.target.value });
                    }}
                    className="h-7 font-mono text-xs text-foreground"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  订阅主题 (连接时订阅)
                </span>
                <MqttSubscriptionList
                  subscriptions={tab.mqtt?.subscriptions ?? []}
                  onChange={(subs) => {
                    updateMqttSubscriptions(tab.id, subs);
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {tab.protocol === "socketio" && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  命名空间
                  <Input
                    value={tab.socketio?.namespace ?? ""}
                    placeholder="/ (默认)"
                    spellCheck={false}
                    onChange={(e) =>
                      updateSocketIoNamespace(tab.id, e.target.value)
                    }
                    className="h-7 font-mono text-xs text-foreground"
                  />
                </label>
              )}
              {tab.protocol === "websocket" && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  子协议 (逗号分隔)
                  <Input
                    value={(tab.ws?.subprotocols ?? []).join(", ")}
                    placeholder="如 graphql-ws, soap"
                    spellCheck={false}
                    onChange={(e) =>
                      updateWsSubprotocols(
                        tab.id,
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s !== ""),
                      )
                    }
                    className="h-7 font-mono text-xs text-foreground"
                  />
                </label>
              )}
              {(tab.protocol === "websocket" ||
                tab.protocol === "socketio" ||
                tab.protocol === "sse") && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">请求头</span>
                  <KeyValueTable
                    items={headers}
                    onChange={(items) => updateConnectionHeaders(tab.id, items)}
                    keyPlaceholder="头名"
                    valuePlaceholder="值 (支持 {{变量}})"
                  />
                </div>
              )}
            </>
          )}
          {/* TLS / 高级设置: 启用 TLS/WSS/HTTPS/MQTTS 的连接可在此关 SSL 校验/设 CA/客户端证书/版本. */}
          {settings !== undefined && (
            <div className="flex flex-col gap-2 border-t pt-2 text-xs text-muted-foreground">
              <span className="text-muted-foreground">TLS / 高级</span>
              <TlsSettingsFields
                settings={settings}
                onPatch={(partial) => updateConnectionSettings(tab.id, partial)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
