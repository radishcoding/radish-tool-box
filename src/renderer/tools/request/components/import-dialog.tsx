import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { parseCurl } from "../model/import/curl";
import { parseHar } from "../model/import/har";
import { parseOpenApi } from "../model/import/openapi";
import { parsePostman } from "../model/import/postman";
import { useRequestStore } from "../store/request-store";

/**
 * 导入来源类型.
 */
type Source = "curl" | "openapi" | "postman" | "har";

/**
 * 来源选项.
 */
const SOURCES: ReadonlyArray<{ readonly id: Source; readonly label: string }> =
  [
    { id: "curl", label: "cURL" },
    { id: "openapi", label: "OpenAPI" },
    { id: "postman", label: "Postman" },
    { id: "har", label: "HAR" },
  ];

/**
 * 导入弹层: 选来源 + 粘贴内容 + 解析落库 (curl -> 新标签; 其余 -> 新集合).
 * @param onClose 关闭回调.
 */
export function ImportDialog({
  onClose,
}: {
  readonly onClose: () => void;
}): ReactElement {
  const importCollection = useRequestStore((s) => s.importCollection);
  const openRequestInTab = useRequestStore((s) => s.openRequestInTab);
  const [source, setSource] = useState<Source>("curl");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const doImport = (): void => {
    setError("");
    try {
      if (source === "curl") {
        const request = parseCurl(text);
        openRequestInTab(
          request.url === "" ? "导入的请求" : request.url,
          request,
        );
      } else {
        const collection =
          source === "openapi"
            ? parseOpenApi(text)
            : source === "postman"
              ? parsePostman(text)
              : parseHar(text);
        importCollection(collection);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="导入"
        className="flex max-h-[85vh] w-[32rem] flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium">导入请求</span>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
          {SOURCES.map((s) => (
            <Button
              key={s.id}
              variant="ghost"
              size="sm"
              onClick={() => setSource(s.id)}
              className={cn(
                "h-7 flex-1 cursor-pointer text-xs transition-all",
                source === s.id
                  ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            source === "curl" ? "粘贴 curl 命令" : "粘贴文件内容 (JSON/YAML)"
          }
          spellCheck={false}
          // 限制最大高度并内部滚动: 避免大文本经 field-sizing 把弹层撑出屏幕.
          className="max-h-[55vh] min-h-48 resize-none overflow-auto bg-muted/40 font-mono text-xs leading-relaxed"
        />
        {error !== "" && (
          <span className="max-h-24 shrink-0 overflow-auto rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs break-all text-destructive">
            {error}
          </span>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={text.trim() === ""}
            onClick={doImport}
          >
            导入
          </Button>
        </div>
      </div>
    </div>
  );
}
