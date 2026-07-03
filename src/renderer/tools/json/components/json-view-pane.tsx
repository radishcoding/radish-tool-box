import { Copy, ExternalLink } from "lucide-react";
import { useMemo, type ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";
import { SegmentedToggle } from "@/components/common/segmented-toggle";
import { Transition } from "@/components/common/transition";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

import {
  findNodeAtOffset,
  findNodeByKey,
  nodeRange,
} from "../model/offset-mapping";
import { useDocumentStore, type JsonDocument } from "../store/document-store";
import { JsonEditor } from "./json-editor";
import { JsonInspector } from "./json-inspector";
import { JsonSearchBar } from "./json-search-bar";
import { JsonTreeView } from "./json-tree-view";

/**
 * 视图模式切换选项.
 */
const VIEW_OPTIONS = [
  { value: "tree", label: "树" },
  { value: "raw", label: "原文" },
] as const;

/**
 * 单个 JSON 视图面板: 上为树/原文视图, 下为可折叠检视区; 当前展示激活文档.
 */
export function JsonViewPane({
  title,
  documentId,
  lockedMode,
}: {
  readonly title: string;
  readonly documentId?: string;
  readonly lockedMode?: "tree" | "raw";
}): ReactElement {
  const doc = useDocumentStore((state) =>
    state.documents.find((item) => item.id === (documentId ?? state.activeId)),
  );
  const setText = useDocumentStore((state) => state.setText);
  const setViewMode = useDocumentStore((state) => state.setViewMode);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const expandAll = useDocumentStore((state) => state.expandAll);
  const serializeDocument = useDocumentStore(
    (state) => state.serializeDocument,
  );

  const debouncedSetText = useDebouncedCallback((next: string) => {
    if (doc) {
      setText(doc.id, next);
    }
  }, 150);

  // 选中节点的源码区间 (用于原文模式 reveal)
  const revealRange = useMemo(() => {
    if (!doc?.parseResult.root || !doc.selectedKey) {
      return undefined;
    }
    const node = findNodeByKey(doc.parseResult.root, doc.selectedKey);
    return node ? nodeRange(node) : undefined;
  }, [doc]);

  if (!doc) {
    return <div className="h-full rounded-xl border bg-card" />;
  }

  const root = doc.parseResult.root;
  const viewMode = lockedMode ?? doc.viewMode;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2.5">
        <span className="truncate text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-1">
          {!lockedMode && (
            <SegmentedToggle
              options={VIEW_OPTIONS}
              value={doc.viewMode}
              onChange={(next) => {
                if (next === "tree" || next === "raw") {
                  setViewMode(doc.id, next);
                }
              }}
            />
          )}
          <IconAction
            icon={Copy}
            label="复制原文"
            onClick={() => void copyText(doc.text)}
          />
          <IconAction
            icon={ExternalLink}
            label="弹出独立窗口"
            onClick={() =>
              window.windowControls.popout(serializeDocument(doc.id))
            }
          />
        </div>
      </div>
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="68%" minSize="30%">
          <Transition
            transitionKey={viewMode}
            variant="fade"
            className="h-full"
          >
            {viewMode === "raw" ? (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <JsonEditor
                    value={doc.text}
                    onChange={debouncedSetText}
                    error={doc.parseResult.error}
                    revealRange={revealRange}
                    localizedContextMenu
                    onCursorOffset={(offset) => {
                      if (!root) {
                        return;
                      }
                      const node = findNodeAtOffset(root, offset, doc.text);
                      selectNode(doc.id, node ?? undefined);
                    }}
                    formatOnPaste
                    onPaste={(text) => {
                      setText(doc.id, text);
                      expandAll(doc.id);
                    }}
                  />
                </div>
                <ParseStatus document={doc} />
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <JsonSearchBar documentId={doc.id} />
                <div className="min-h-0 flex-1">
                  <JsonTreeView documentId={doc.id} />
                </div>
              </div>
            )}
          </Transition>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="32%"
          minSize="14%"
          collapsible
          collapsedSize="0%"
        >
          <JsonInspector documentId={doc.id} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

/**
 * 解析状态条: 显示空/已解析/容错/错误.
 */
function ParseStatus({
  document,
}: {
  readonly document: JsonDocument;
}): ReactElement {
  const { parseResult, text } = document;
  let label: string;
  let tone: string;
  if (parseResult.error) {
    label = `解析错误 (位置 ${parseResult.error.offset}): ${parseResult.error.message}`;
    tone = "text-destructive";
  } else if (text.trim() === "") {
    label = "空文档";
    tone = "text-muted-foreground";
  } else if (parseResult.repaired) {
    label = "已按容错解析";
    tone = "text-primary";
  } else {
    label = "已解析";
    tone = "text-muted-foreground";
  }
  return (
    <div className={cn("shrink-0 border-t px-2.5 py-1 text-xs", tone)}>
      {label}
    </div>
  );
}
