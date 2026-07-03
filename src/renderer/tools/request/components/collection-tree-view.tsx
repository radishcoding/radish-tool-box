import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import { useState, type DragEvent, type ReactElement } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

import type { CollectionNode } from "../model/types";
import { InlineRename } from "./inline-rename";

/** 每一层的缩进像素. */
const INDENT = 16;

/** 拖拽请求节点时携带的自定义数据类型. */
export const NODE_DRAG_MIME = "application/x-request-node";

/** 拖拽负载: 源集合 id 与被拖节点 id. */
export interface NodeDragData {
  readonly collectionId: string;
  readonly nodeId: string;
}

/**
 * 从拖放事件读取节点拖拽负载; 非本类型或解析失败返回 undefined.
 * @param event 拖放事件.
 * @returns 拖拽负载或 undefined.
 */
export function readNodeDrag(
  event: DragEvent<HTMLElement>,
): NodeDragData | undefined {
  const raw = event.dataTransfer.getData(NODE_DRAG_MIME);
  if (raw === "") {
    return undefined;
  }
  try {
    return JSON.parse(raw) as NodeDragData;
  } catch {
    return undefined;
  }
}

/**
 * 树节点的一组操作回调 (collectionId 为当前集合, 用于拖拽落点与源判定).
 */
export interface TreeHandlers {
  readonly collectionId: string;
  /** 当前处于重命名编辑态的节点 id. */
  readonly editingId: string | undefined;
  readonly onOpenRequest: (nodeId: string) => void;
  readonly onDeleteNode: (nodeId: string) => void;
  readonly onRenameNode: (nodeId: string, name: string) => void;
  readonly onAddSubfolder: (parentId: string) => void;
  readonly onStartRename: (nodeId: string) => void;
  readonly onCancelRename: () => void;
  /** 把源集合的节点移动到本集合的 targetParentId (undefined 表示本集合根). */
  readonly onMoveNode: (
    fromCollectionId: string,
    nodeId: string,
    targetParentId: string | undefined,
  ) => void;
}

/**
 * 延迟进入重命名态: 让右键菜单先关闭并归还焦点, 避免抢占输入框焦点.
 * @param start 进入重命名的回调.
 */
function deferStartRename(start: () => void): void {
  requestAnimationFrame(start);
}

/**
 * 递归渲染集合节点树; 文件夹可折叠/接收拖放, 请求节点可拖动/点击打开, 右键菜单增删改.
 * @param nodes 节点列表.
 * @param depth 缩进层级.
 * @param handlers 节点操作回调.
 */
export function CollectionTreeView({
  nodes,
  depth = 0,
  handlers,
}: {
  readonly nodes: readonly CollectionNode[];
  readonly depth?: number;
  readonly handlers: TreeHandlers;
}): ReactElement {
  return (
    <div className="flex flex-col">
      {nodes.map((node) =>
        node.type === "folder" ? (
          <FolderRow
            key={node.id}
            node={node}
            depth={depth}
            handlers={handlers}
          />
        ) : (
          <RequestRow
            key={node.id}
            node={node}
            depth={depth}
            handlers={handlers}
          />
        ),
      )}
    </div>
  );
}

/**
 * 请求节点行: 可拖动, 点击打开, 右键菜单打开/重命名/删除.
 */
function RequestRow({
  node,
  depth,
  handlers,
}: {
  readonly node: Extract<CollectionNode, { type: "request" }>;
  readonly depth: number;
  readonly handlers: TreeHandlers;
}): ReactElement {
  const editing = handlers.editingId === node.id;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          draggable={!editing}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              NODE_DRAG_MIME,
              JSON.stringify({
                collectionId: handlers.collectionId,
                nodeId: node.id,
              } satisfies NodeDragData),
            );
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => {
            if (!editing) {
              handlers.onOpenRequest(node.id);
            }
          }}
          onKeyDown={(e) => {
            if (!editing && (e.key === "Enter" || e.key === " ")) {
              handlers.onOpenRequest(node.id);
            }
          }}
          style={{ paddingLeft: `${depth * INDENT + 4}px` }}
          className="group flex h-7 items-center gap-1 rounded text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="w-3.5 shrink-0" />
          <FileText className="size-3.5 shrink-0 opacity-60" />
          {editing ? (
            <InlineRename
              value={node.name}
              onCommit={(name) => {
                handlers.onRenameNode(node.id, name);
                handlers.onCancelRename();
              }}
              onCancel={handlers.onCancelRename}
            />
          ) : (
            <span className="flex-1 truncate">{node.name}</span>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-40"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ContextMenuItem onSelect={() => handlers.onOpenRequest(node.id)}>
          <SquareArrowOutUpRight />
          打开
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            deferStartRename(() => handlers.onStartRename(node.id))
          }
        >
          <Pencil />
          重命名
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => handlers.onDeleteNode(node.id)}
        >
          <Trash2 />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * 文件夹行 (可折叠, 可作为拖放落点); 右键菜单新建子文件夹/重命名/删除.
 */
function FolderRow({
  node,
  depth,
  handlers,
}: {
  readonly node: Extract<CollectionNode, { type: "folder" }>;
  readonly depth: number;
  readonly handlers: TreeHandlers;
}): ReactElement {
  const [open, setOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const editing = handlers.editingId === node.id;
  return (
    <div className="flex flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!editing) {
                setOpen((v) => !v);
              }
            }}
            onKeyDown={(e) => {
              if (!editing && (e.key === "Enter" || e.key === " ")) {
                setOpen((v) => !v);
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(NODE_DRAG_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOver(true);
              }
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const data = readNodeDrag(e);
              if (data !== undefined && data.nodeId !== node.id) {
                handlers.onMoveNode(data.collectionId, data.nodeId, node.id);
                setOpen(true);
              }
            }}
            style={{ paddingLeft: `${depth * INDENT + 4}px` }}
            className={cn(
              "group flex h-7 cursor-pointer items-center gap-1 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
              dragOver && "bg-accent text-accent-foreground ring-1 ring-ring",
            )}
          >
            {open ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )}
            <Folder className="size-3.5 shrink-0 opacity-60" />
            {editing ? (
              <InlineRename
                value={node.name}
                onCommit={(name) => {
                  handlers.onRenameNode(node.id, name);
                  handlers.onCancelRename();
                }}
                onCancel={handlers.onCancelRename}
              />
            ) : (
              <span className="flex-1 truncate">{node.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="w-40"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <ContextMenuItem onSelect={() => handlers.onAddSubfolder(node.id)}>
            <FolderPlus />
            新建子文件夹
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              deferStartRename(() => handlers.onStartRename(node.id))
            }
          >
            <Pencil />
            重命名
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => handlers.onDeleteNode(node.id)}
          >
            <Trash2 />
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {open && (
        <CollectionTreeView
          nodes={node.children}
          depth={depth + 1}
          handlers={handlers}
        />
      )}
    </div>
  );
}
