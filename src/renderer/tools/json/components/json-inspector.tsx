import { Braces, ChevronDown, Copy } from "lucide-react";
import { useMemo, type ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/clipboard";
import { sortByLength } from "@/lib/sort-by-length";

import { tryParseStringAsJson } from "../model/escape";
import { formatPath, type PathFormat } from "../model/json-path";
import { nodeValue } from "../model/node-value";
import { findNodeByKey } from "../model/offset-mapping";
import { useDocumentStore } from "../store/document-store";
import { JsonEditor } from "./json-editor";

/**
 * 路径格式选项.
 */
const PATH_FORMATS: ReadonlyArray<{ value: PathFormat; label: string }> = [
  { value: "js", label: "JS 访问器" },
  { value: "jsonpath", label: "JSONPath" },
  { value: "pointer", label: "JSON Pointer" },
];

/**
 * JSON 检视区: 选中节点的路径 (可切格式 + 复制) 与值 (只读 Monaco + 复制 + 解析为 JSON).
 */
export function JsonInspector({
  documentId,
}: {
  readonly documentId?: string;
}): ReactElement {
  const doc = useDocumentStore((state) =>
    state.documents.find((item) => item.id === (documentId ?? state.activeId)),
  );
  const pathFormat = useDocumentStore((state) => state.pathFormat);
  const setPathFormat = useDocumentStore((state) => state.setPathFormat);
  const pathPrefix = useDocumentStore((state) => state.pathPrefix);
  const setPathPrefix = useDocumentStore((state) => state.setPathPrefix);
  const openDocument = useDocumentStore((state) => state.openDocument);

  const node = useMemo(() => {
    if (!doc?.parseResult.root || !doc.selectedKey) {
      return undefined;
    }
    return findNodeByKey(doc.parseResult.root, doc.selectedKey);
  }, [doc]);

  const basePath = node ? formatPath(node.path, pathFormat) : "";
  // 仅在路径非空时加前缀, 避免未选中/根节点显示孤立的 "//"
  const pathText = pathPrefix && basePath ? `//${basePath}` : basePath;
  const value = node && doc ? nodeValue(node, doc.text) : undefined;
  const parsable =
    node?.type === "string" &&
    node.scalarText !== undefined &&
    tryParseStringAsJson(node.scalarText) !== undefined;
  const activeFormatLabel =
    PATH_FORMATS.find((item) => item.value === pathFormat)?.label ?? "";

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex shrink-0 items-center gap-2 border-b px-2.5 py-1.5">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          路径
        </span>
        <Input
          readOnly
          value={pathText}
          placeholder="选择节点查看路径"
          className="h-7 flex-1 bg-card font-mono text-xs focus-visible:ring-1"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
            >
              {activeFormatLabel}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {sortByLength(PATH_FORMATS, (i) => i.label).map((item) => (
              <DropdownMenuItem
                key={item.value}
                onSelect={() => setPathFormat(item.value)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconAction
          icon={Copy}
          label="复制路径"
          onClick={() => void copyText(pathText)}
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground select-none">
          <Checkbox
            checked={pathPrefix}
            onCheckedChange={(checked) => setPathPrefix(checked === true)}
          />
          显示前缀
        </label>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2.5 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">值</span>
        <div className="flex items-center gap-1">
          {parsable && node && (
            <IconAction
              icon={Braces}
              label="解析为 JSON"
              onClick={() => openDocument(node.scalarText ?? "")}
            />
          )}
          <IconAction
            icon={Copy}
            label="复制值"
            onClick={() => void copyText(value?.text ?? "")}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {value ? (
          <JsonEditor value={value.text} readOnly language={value.language} />
        ) : (
          <div className="p-3 font-mono text-xs text-muted-foreground">
            未选择节点
          </div>
        )}
      </div>
    </div>
  );
}
