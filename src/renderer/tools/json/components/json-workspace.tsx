import { ChevronDown } from "lucide-react";
import type { ReactElement } from "react";

import { SegmentedToggle } from "@/components/common/segmented-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { useDocumentStore } from "../store/document-store";
import { JsonDiffEditor } from "./json-diff-editor";
import { JsonSemanticDiff } from "./json-semantic-diff";
import { JsonViewPane } from "./json-view-pane";

/**
 * 对比子模式切换选项.
 */
const COMPARE_OPTIONS = [
  { value: "raw", label: "原文" },
  { value: "tree", label: "树" },
  { value: "semantic", label: "语义" },
] as const;

/**
 * JSON 工作区: 单视图满宽; 对比时整体共享 原文/树/语义 切换, B 侧从已有文档选取.
 */
export function JsonWorkspace(): ReactElement {
  const documents = useDocumentStore((state) => state.documents);
  const activeId = useDocumentStore((state) => state.activeId);
  const compare = useDocumentStore((state) => state.compare);
  const compareMode = useDocumentStore((state) => state.compareMode);
  const compareBId = useDocumentStore((state) => state.compareBId);
  const pathFormat = useDocumentStore((state) => state.pathFormat);
  const setCompareMode = useDocumentStore((state) => state.setCompareMode);
  const setCompareB = useDocumentStore((state) => state.setCompareB);

  if (!compare) {
    return <JsonViewPane title="视图" />;
  }

  const docA = documents.find((doc) => doc.id === activeId);
  const docB = documents.find((doc) => doc.id === compareBId);
  const candidates = documents.filter((doc) => doc.id !== activeId);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <SegmentedToggle
          options={COMPARE_OPTIONS}
          value={compareMode}
          onChange={(next) => {
            if (next === "raw" || next === "tree" || next === "semantic") {
              setCompareMode(next);
            }
          }}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">A: {docA?.title}</span>
          <span>vs</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                B: {docB?.title ?? "选择文档"}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {candidates.length === 0 ? (
                <DropdownMenuItem disabled>无其它文档</DropdownMenuItem>
              ) : (
                candidates.map((doc) => (
                  <DropdownMenuItem
                    key={doc.id}
                    onSelect={() => setCompareB(doc.id)}
                  >
                    {doc.title}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {!docB ? (
          <div className="flex h-full items-center justify-center rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            请选择对比文档 B (从右上角下拉, 或新建一个文档)
          </div>
        ) : compareMode === "raw" ? (
          <JsonDiffEditor original={docA?.text ?? ""} modified={docB.text} />
        ) : compareMode === "tree" ? (
          <ResizablePanelGroup orientation="horizontal" className="gap-3">
            <ResizablePanel defaultSize="50%" minSize="25%">
              <JsonViewPane title="A" documentId={activeId} lockedMode="tree" />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="50%" minSize="25%">
              <JsonViewPane title="B" documentId={docB.id} lockedMode="tree" />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <JsonSemanticDiff
            original={docA?.text ?? ""}
            modified={docB.text}
            pathFormat={pathFormat}
          />
        )}
      </div>
    </div>
  );
}
