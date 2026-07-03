import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  connect,
  disconnect,
  sendMessage,
} from "@/hooks/use-request-execution";
import type { FileFilter } from "../../../../ipc-channels";
import { GRPC_END_SENTINEL } from "../../../../network/request-channels";
import type { GrpcMethodInfo, RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { FilePathInput } from "./file-path-input";
import { KeyValueTable } from "./key-value-table";

/** select 原生控件的通用样式, 与 connection-editor 一致. */
const SELECT_CLASS =
  "h-8 cursor-pointer rounded-md border border-input bg-transparent px-2 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50";

/** proto 文件选择过滤器. */
const PROTO_FILTERS: readonly FileFilter[] = [
  { name: "Proto", extensions: ["proto"] },
  { name: "所有文件", extensions: ["*"] },
];

/**
 * 取当前选中方法的自省信息 (用于判断流式).
 * @param tab 标签.
 * @returns 方法信息或 undefined.
 */
function selectedMethod(tab: RequestTab): GrpcMethodInfo | undefined {
  const svc = tab.grpcServices?.find((s) => s.name === tab.grpc?.serviceName);
  return svc?.methods.find((m) => m.name === tab.grpc?.methodName);
}

/**
 * gRPC 编辑区: proto 源 + 服务/方法选择 + target/TLS + metadata + 请求消息 + 调用.
 * 客户端流/双向流连接后显示逐条发送框与结束发送按钮.
 * @param tab 当前 gRPC 标签.
 */
export function GrpcEditor({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateGrpcConfig = useRequestStore((s) => s.updateGrpcConfig);
  const setGrpcServices = useRequestStore((s) => s.setGrpcServices);
  const connection = useRequestStore((s) => s.connections[tab.id]);
  const clearMessages = useRequestStore((s) => s.clearMessages);
  const [reflecting, setReflecting] = useState(false);
  const [reflectError, setReflectError] = useState("");
  const [streamDraft, setStreamDraft] = useState("");

  const grpc = tab.grpc;
  const status = connection?.status ?? "idle";
  const isOpen = status === "open";
  const method = selectedMethod(tab);
  const canStreamSend = isOpen && method?.requestStream === true;

  const runReflect = async (): Promise<void> => {
    if (grpc === undefined) return;
    setReflecting(true);
    setReflectError("");
    const result = await window.networkApi.grpcReflect(grpc.protoSource);
    setReflecting(false);
    if (result.ok) {
      setGrpcServices(tab.id, result.services);
    } else {
      setReflectError(result.error);
    }
  };

  if (grpc === undefined) {
    return (
      <div className="p-3 text-xs text-muted-foreground">非 gRPC 标签</div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* proto 源区 */}
      <div className="flex flex-col gap-1.5 px-3 pt-3">
        <div className="flex items-center gap-3 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input
              type="radio"
              checked={grpc.protoSource.kind === "file"}
              onChange={() =>
                updateGrpcConfig(tab.id, {
                  protoSource: { kind: "file", value: grpc.protoSource.value },
                })
              }
              className="size-3.5 cursor-pointer accent-primary"
            />
            文件路径
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input
              type="radio"
              checked={grpc.protoSource.kind === "text"}
              onChange={() =>
                updateGrpcConfig(tab.id, {
                  protoSource: { kind: "text", value: grpc.protoSource.value },
                })
              }
              className="size-3.5 cursor-pointer accent-primary"
            />
            粘贴文本
          </label>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto h-7 cursor-pointer text-xs"
            disabled={reflecting}
            onClick={() => {
              void runReflect();
            }}
          >
            {reflecting ? "解析中..." : "解析 proto"}
          </Button>
        </div>
        {grpc.protoSource.kind === "file" ? (
          <FilePathInput
            value={grpc.protoSource.value}
            placeholder="proto 文件绝对路径"
            filters={PROTO_FILTERS}
            onChange={(p) =>
              updateGrpcConfig(tab.id, {
                protoSource: { kind: "file", value: p },
              })
            }
          />
        ) : (
          <Textarea
            value={grpc.protoSource.value}
            placeholder="粘贴 .proto 内容"
            spellCheck={false}
            onChange={(e) =>
              updateGrpcConfig(tab.id, {
                protoSource: { kind: "text", value: e.target.value },
              })
            }
            className="h-28 font-mono text-xs"
          />
        )}
        {reflectError !== "" && (
          <span className="text-xs text-destructive">{reflectError}</span>
        )}
      </div>

      {/* 服务/方法选择 */}
      <div className="flex gap-2 px-3 py-2">
        <select
          aria-label="服务"
          value={grpc.serviceName}
          onChange={(e) =>
            updateGrpcConfig(tab.id, {
              serviceName: e.target.value,
              methodName: "",
            })
          }
          className={cn(SELECT_CLASS, "flex-1")}
        >
          <option value="">选择服务</option>
          {tab.grpcServices?.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="方法"
          value={grpc.methodName}
          onChange={(e) =>
            updateGrpcConfig(tab.id, { methodName: e.target.value })
          }
          className={cn(SELECT_CLASS, "flex-1")}
        >
          <option value="">选择方法</option>
          {tab.grpcServices
            ?.find((s) => s.name === grpc.serviceName)
            ?.methods.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
                {m.requestStream ? " (流请求)" : ""}
                {m.responseStream ? " (流响应)" : ""}
              </option>
            ))}
        </select>
      </div>

      {/* target + TLS + 调用/取消 */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <Input
          value={grpc.target}
          placeholder="host:port (如 127.0.0.1:50051)"
          spellCheck={false}
          onChange={(e) => updateGrpcConfig(tab.id, { target: e.target.value })}
          className="h-8 flex-1 font-mono text-xs"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={grpc.tls}
            onChange={(e) =>
              updateGrpcConfig(tab.id, { tls: e.target.checked })
            }
            className="size-3.5 cursor-pointer accent-primary"
          />
          TLS
        </label>
        {isOpen || status === "connecting" ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-20 cursor-pointer"
            onClick={() => {
              disconnect(tab.id);
            }}
          >
            取消
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 w-20 cursor-pointer"
            disabled={
              grpc.target === "" ||
              grpc.serviceName === "" ||
              grpc.methodName === ""
            }
            onClick={() => {
              connect(tab.id, { protocol: "grpc", grpc });
            }}
          >
            调用
          </Button>
        )}
      </div>

      {/* 连接状态行, 与 connection-editor 对齐 */}
      <div className="flex items-center gap-2 px-3 py-1 text-xs">
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

      {/* metadata */}
      <div className="flex flex-col gap-1 border-t px-3 py-2">
        <span className="text-xs text-muted-foreground">Metadata</span>
        <KeyValueTable
          items={grpc.metadata}
          onChange={(items) => updateGrpcConfig(tab.id, { metadata: items })}
          keyPlaceholder="键"
          valuePlaceholder="值 (支持 {{变量}})"
        />
      </div>

      {/* 请求消息 (一元/服务端流 调用时; 客户端流/双向流为首条模板) */}
      <div className="flex flex-col gap-1 border-t px-3 py-2">
        <span className="text-xs text-muted-foreground">请求消息 (JSON)</span>
        <Textarea
          value={grpc.requestMessage}
          placeholder='{"name":"world"}'
          spellCheck={false}
          onChange={(e) =>
            updateGrpcConfig(tab.id, { requestMessage: e.target.value })
          }
          className="h-28 font-mono text-xs"
        />
      </div>

      {/* 客户端流/双向流: 连接后逐条发送 + 结束发送 */}
      {canStreamSend && (
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Input
            value={streamDraft}
            placeholder="流消息 (JSON)"
            spellCheck={false}
            onChange={(e) => {
              setStreamDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && streamDraft !== "") {
                sendMessage(tab.id, { event: "", data: streamDraft });
                setStreamDraft("");
              }
            }}
            className="h-8 flex-1 font-mono text-xs"
          />
          <Button
            size="sm"
            className="h-8 w-16 cursor-pointer"
            disabled={streamDraft === ""}
            onClick={() => {
              sendMessage(tab.id, { event: "", data: streamDraft });
              setStreamDraft("");
            }}
          >
            发送
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-20 cursor-pointer"
            onClick={() => {
              sendMessage(tab.id, { event: GRPC_END_SENTINEL, data: "" });
            }}
          >
            结束发送
          </Button>
        </div>
      )}
    </div>
  );
}
