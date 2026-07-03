import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactElement } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

import {
  flattenTree,
  nodeKey,
  type JsonNode,
  type PathSegment,
  type VisibleRow,
} from "../model/json-node";
import { formatPath, type PathFormat } from "../model/json-path";
import { nodeValue } from "../model/node-value";
import { useDocumentStore } from "../store/document-store";

/**
 * 树行高 (像素).
 */
const ROW_HEIGHT = 24;

/**
 * 每层缩进 (像素).
 */
const INDENT = 14;

/**
 * 据命中 nodeKey 计算过滤模式下应保留的 key 集合 (命中 + 其全部祖先).
 */
function keepSetFromMatchKeys(matchKeys: readonly string[]): Set<string> {
  const keep = new Set<string>();
  for (const key of matchKeys) {
    keep.add(key);
    const path = JSON.parse(key) as PathSegment[];
    for (let index = 0; index < path.length; index += 1) {
      keep.add(JSON.stringify(path.slice(0, index)));
    }
  }
  return keep;
}

/**
 * 节点值在树行内的预览文本.
 */
function valuePreview(node: JsonNode): string {
  switch (node.type) {
    case "object":
      return `{ ${node.children.length} }`;
    case "array":
      return `[ ${node.children.length} ]`;
    case "string":
      return `"${node.scalarText ?? ""}"`;
    default:
      return node.scalarText ?? "";
  }
}

/**
 * 节点值的着色类 (Tailwind 内置色板 + 主题 token, 不依赖自定义色 utility).
 */
function valueClass(node: JsonNode): string {
  switch (node.type) {
    case "string":
      return "text-emerald-600";
    case "number":
      return "text-primary";
    case "boolean":
      return "text-purple-600";
    default:
      return "text-muted-foreground";
  }
}

/**
 * 虚拟化自绘 JSON 树: 展示激活文档, 支持展开/折叠/选中/搜索高亮/过滤/右键复制.
 */
export function JsonTreeView({
  documentId,
}: {
  readonly documentId?: string;
}): ReactElement {
  const doc = useDocumentStore((state) =>
    state.documents.find((item) => item.id === (documentId ?? state.activeId)),
  );
  const pathFormat = useDocumentStore((state) => state.pathFormat);
  const toggleExpand = useDocumentStore((state) => state.toggleExpand);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const revealKey = useDocumentStore((state) => state.revealKey);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const root = doc?.parseResult.root;
  const filtering = Boolean(
    doc?.search.filtering && doc.search.matchKeys.length > 0,
  );

  const rows = useMemo<VisibleRow[]>(() => {
    if (!root || !doc) {
      return [];
    }
    if (filtering) {
      const keep = keepSetFromMatchKeys(doc.search.matchKeys);
      return flattenTree(root, () => true).filter((row) =>
        keep.has(nodeKey(row.node)),
      );
    }
    return flattenTree(root, (node) => doc.expanded.has(nodeKey(node)));
  }, [root, doc, filtering]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const selectedKey = doc?.selectedKey;
  const matchSet = useMemo(
    () => new Set(doc?.search.matchKeys ?? []),
    [doc?.search.matchKeys],
  );

  // 上次为"显示选中项"而展开过的 key; 仅当选中项变化时才自动展开其祖先,
  // 这样用户主动全部折叠 (选中项未变) 时不会把选中项那一路重新展开
  const lastRevealedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!doc || !selectedKey) {
      lastRevealedRef.current = selectedKey;
      return;
    }
    const index = rows.findIndex((row) => nodeKey(row.node) === selectedKey);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: "auto" });
      lastRevealedRef.current = selectedKey;
    } else if (!filtering && selectedKey !== lastRevealedRef.current) {
      lastRevealedRef.current = selectedKey;
      revealKey(doc.id, selectedKey);
    }
  }, [doc, selectedKey, rows, filtering, virtualizer, revealKey]);

  if (!root || !doc) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        无可解析的 JSON
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          const key = nodeKey(row.node);
          return (
            <div
              key={item.key}
              className="absolute left-0 top-0 w-full"
              style={{
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <JsonTreeRow
                row={row}
                selected={key === selectedKey}
                matched={matchSet.has(key)}
                pathFormat={pathFormat}
                documentText={doc.text}
                onToggle={() => toggleExpand(doc.id, row.node)}
                onSelect={() => selectNode(doc.id, row.node)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 单个树行 (含右键复制菜单).
 */
function JsonTreeRow({
  row,
  selected,
  matched,
  pathFormat,
  documentText,
  onToggle,
  onSelect,
}: {
  readonly row: VisibleRow;
  readonly selected: boolean;
  readonly matched: boolean;
  readonly pathFormat: PathFormat;
  readonly documentText: string;
  readonly onToggle: () => void;
  readonly onSelect: () => void;
}): ReactElement {
  const { node, depth, expandable, expanded } = row;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "flex h-6 cursor-pointer items-center gap-1 pr-2 font-mono text-xs hover:bg-muted/50",
            selected && "bg-primary/10",
            matched && !selected && "bg-amber-100",
          )}
          style={{ paddingLeft: `${depth * INDENT + 4}px` }}
          onClick={onSelect}
        >
          <button
            type="button"
            className={cn(
              "flex size-4 shrink-0 items-center justify-center text-muted-foreground",
              !expandable && "invisible",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
          <span className="truncate">
            {node.key !== undefined && (
              <>
                <span className="text-foreground">{String(node.key)}</span>
                <span className="text-muted-foreground">: </span>
              </>
            )}
            <span className={valueClass(node)}>{valuePreview(node)}</span>
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void copyText(String(node.key ?? ""))}>
          复制键名
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void copyText(nodeValue(node, documentText).text)}
        >
          复制值
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void copyText(formatPath(node.path, pathFormat))}
        >
          复制路径
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            void copyText(
              documentText.slice(node.offset, node.offset + node.length),
            )
          }
        >
          复制子树 JSON
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
