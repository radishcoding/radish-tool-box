import { X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type {
  BodyConfig,
  FormDataItem,
  RawType,
  RequestTab,
} from "../model/types";
import { useRequestStore } from "../store/request-store";
import { KeyValueTable } from "./key-value-table";

/**
 * 体类型选项.
 */
const BODY_TYPES: ReadonlyArray<{
  readonly value: BodyConfig["type"];
  readonly label: string;
}> = [
  { value: "none", label: "无" },
  { value: "raw", label: "Raw" },
  { value: "urlencoded", label: "x-www-form-urlencoded" },
  { value: "formdata", label: "form-data" },
  { value: "binary", label: "Binary" },
  { value: "graphql", label: "GraphQL" },
];

/**
 * raw 子类型选项.
 */
const RAW_TYPES: readonly RawType[] = [
  "json",
  "xml",
  "text",
  "html",
  "javascript",
];

/**
 * 切换体类型时构造该类型的默认配置.
 */
function defaultBody(type: BodyConfig["type"]): BodyConfig {
  switch (type) {
    case "raw":
      return { type: "raw", rawType: "json", text: "" };
    case "urlencoded":
      return { type: "urlencoded", items: [] };
    case "formdata":
      return { type: "formdata", items: [] };
    case "binary":
      return { type: "binary", filePath: "" };
    case "graphql":
      return { type: "graphql", query: "", variables: "" };
    default:
      return { type: "none" };
  }
}

/**
 * 通过文件对话框取一个文件的绝对路径.
 * @returns 选中文件信息, 或 undefined (取消).
 */
async function pickFile(): Promise<{ path: string; name: string } | undefined> {
  const opened = await window.fileApi.open();
  return opened ? { path: opened.path, name: opened.name } : undefined;
}

/**
 * form-data 单行 (文本或文件).
 */
function FormDataRow({
  item,
  onPatch,
  onRemove,
}: {
  readonly item: FormDataItem;
  readonly onPatch: (partial: Partial<FormDataItem>) => void;
  readonly onRemove: () => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onPatch({ enabled: e.target.checked })}
        className="size-3.5 cursor-pointer accent-primary"
        aria-label="启用此项"
      />
      <Input
        value={item.key}
        placeholder="字段名"
        spellCheck={false}
        onChange={(e) => onPatch({ key: e.target.value })}
        className="h-7 flex-1 font-mono text-xs"
      />
      <Select
        value={item.kind}
        onValueChange={(kind) => onPatch({ kind: kind as "text" | "file" })}
      >
        <SelectTrigger className="h-7 w-20 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text" className="text-xs">
            文本
          </SelectItem>
          <SelectItem value="file" className="text-xs">
            文件
          </SelectItem>
        </SelectContent>
      </Select>
      {item.kind === "file" ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 cursor-pointer justify-start truncate text-xs"
          onClick={() => {
            void pickFile().then((f) => {
              if (f) {
                onPatch({ value: f.path, filename: f.name });
              }
            });
          }}
        >
          {item.filename ?? "选择文件"}
        </Button>
      ) : (
        <Input
          value={item.value}
          placeholder="字段值"
          spellCheck={false}
          onChange={(e) => onPatch({ value: e.target.value })}
          className="h-7 flex-1 font-mono text-xs"
        />
      )}
      <button
        type="button"
        aria-label="删除此项"
        onClick={onRemove}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Body 子页: 体类型选择 + 各类型编辑.
 * @param tab 当前标签.
 */
export function EditorBody({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const body = tab.request.body;
  const setBody = (next: BodyConfig): void =>
    updateRequest(tab.id, { body: next });

  return (
    <div className="flex flex-col gap-3 p-3">
      <Select
        value={body.type}
        onValueChange={(t) => setBody(defaultBody(t as BodyConfig["type"]))}
      >
        <SelectTrigger className="h-7 w-56 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BODY_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value} className="text-xs">
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {body.type === "raw" && (
        <>
          <Select
            value={body.rawType}
            onValueChange={(rawType) =>
              setBody({ ...body, rawType: rawType as RawType })
            }
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RAW_TYPES.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={body.text}
            onChange={(e) => setBody({ ...body, text: e.target.value })}
            placeholder="请求体"
            className="min-h-40 resize-y font-mono text-xs"
          />
        </>
      )}

      {body.type === "urlencoded" && (
        <KeyValueTable
          items={body.items}
          onChange={(items) => setBody({ ...body, items })}
          keyPlaceholder="字段名"
          valuePlaceholder="字段值"
        />
      )}

      {body.type === "formdata" && (
        <div className="flex flex-col gap-1">
          {body.items.map((item) => (
            <FormDataRow
              key={item.id}
              item={item}
              onPatch={(partial) =>
                setBody({
                  ...body,
                  items: body.items.map((it) =>
                    it.id === item.id ? { ...it, ...partial } : it,
                  ),
                })
              }
              onRemove={() =>
                setBody({
                  ...body,
                  items: body.items.filter((it) => it.id !== item.id),
                })
              }
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-fit cursor-pointer gap-1 text-xs text-muted-foreground"
            onClick={() =>
              setBody({
                ...body,
                items: [
                  ...body.items,
                  {
                    id: `fd-${crypto.randomUUID()}`,
                    key: "",
                    value: "",
                    enabled: true,
                    kind: "text",
                  },
                ],
              })
            }
          >
            添加字段
          </Button>
        </div>
      )}

      {body.type === "binary" && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-fit cursor-pointer text-xs"
          onClick={() => {
            void pickFile().then((f) => {
              if (f) {
                setBody({ type: "binary", filePath: f.path });
              }
            });
          }}
        >
          {body.filePath === "" ? "选择文件" : body.filePath}
        </Button>
      )}

      {body.type === "graphql" && (
        <>
          <Textarea
            value={body.query}
            onChange={(e) => setBody({ ...body, query: e.target.value })}
            placeholder="query { ... }"
            className="min-h-32 resize-y font-mono text-xs"
          />
          <Textarea
            value={body.variables}
            onChange={(e) => setBody({ ...body, variables: e.target.value })}
            placeholder='变量 (JSON, 如 {"id": 1})'
            className="min-h-20 resize-y font-mono text-xs"
          />
        </>
      )}
    </div>
  );
}
