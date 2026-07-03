import {
  FolderPlus,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { cn } from "@/lib/utils";

import { useRequestStore } from "../store/request-store";
import { CollectionRunnerDialog } from "./collection-runner-dialog";
import {
  CollectionTreeView,
  NODE_DRAG_MIME,
  readNodeDrag,
  type TreeHandlers,
} from "./collection-tree-view";
import { InlineRename } from "./inline-rename";
import { VariableTable } from "./variable-table";

/**
 * 集合分区: 集合列表 (每个含节点树), 新建集合/文件夹, 打开/删除/重命名节点,
 * 右键菜单增删改, 内联重命名, 以及每个集合的集合变量编辑 (Settings2 展开).
 */
export function SidebarCollections(): ReactElement {
  const collections = useRequestStore((s) => s.collections);
  const createCollection = useRequestStore((s) => s.createCollection);
  const deleteCollection = useRequestStore((s) => s.deleteCollection);
  const addFolder = useRequestStore((s) => s.addFolder);
  const deleteNode = useRequestStore((s) => s.deleteNode);
  const renameNode = useRequestStore((s) => s.renameNode);
  const moveNode = useRequestStore((s) => s.moveNode);
  const openSavedRequest = useRequestStore((s) => s.openSavedRequest);
  const renameCollection = useRequestStore((s) => s.renameCollection);
  const updateCollectionVariables = useRequestStore(
    (s) => s.updateCollectionVariables,
  );

  /** 当前展开变量编辑区的集合 id; undefined 表示全部收起. */
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);

  /** 当前处于重命名编辑态的集合/节点 id; undefined 表示无. */
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  /** 拖放悬停到根 (集合头) 的集合 id; undefined 表示无. */
  const [rootDropId, setRootDropId] = useState<string | undefined>(undefined);

  /** 当前打开运行器的集合 (id + name); undefined 表示关闭. */
  const [runnerCollection, setRunnerCollection] = useState<
    { id: string; name: string } | undefined
  >(undefined);

  /**
   * 切换指定集合的变量编辑区展开状态.
   * @param collectionId 目标集合 id.
   */
  function toggleExpanded(collectionId: string): void {
    setExpandedId((prev) => (prev === collectionId ? undefined : collectionId));
  }

  /**
   * 删除集合并收起其可能展开的变量区.
   * @param collectionId 目标集合 id.
   */
  function removeCollection(collectionId: string): void {
    deleteCollection(collectionId);
    if (expandedId === collectionId) {
      setExpandedId(undefined);
    }
  }

  return (
    <>
      <CollectionRunnerDialog
        open={runnerCollection !== undefined}
        collectionId={runnerCollection?.id}
        collectionName={runnerCollection?.name ?? ""}
        onOpenChange={(o) => {
          if (!o) {
            setRunnerCollection(undefined);
          }
        }}
      />
      <div className="flex h-full flex-col gap-1 overflow-auto p-2 text-xs">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full cursor-pointer justify-start gap-1 text-xs text-muted-foreground"
          onClick={() => setEditingId(createCollection("新集合"))}
        >
          <Plus className="size-3.5" />
          新建集合
        </Button>
        {collections.map((col) => {
          const editing = editingId === col.id;
          const handlers: TreeHandlers = {
            collectionId: col.id,
            editingId,
            onOpenRequest: (nodeId) => openSavedRequest(col.id, nodeId),
            onDeleteNode: (nodeId) => deleteNode(col.id, nodeId),
            onRenameNode: (nodeId, name) => renameNode(col.id, nodeId, name),
            onAddSubfolder: (parentId) =>
              addFolder(col.id, parentId, "新文件夹"),
            onStartRename: (nodeId) => setEditingId(nodeId),
            onCancelRename: () => setEditingId(undefined),
            onMoveNode: (fromCollectionId, nodeId, targetParentId) =>
              moveNode(fromCollectionId, nodeId, col.id, targetParentId),
          };
          return (
            <div key={col.id} className="flex flex-col">
              {/* 集合头部: 名称 + 悬停操作按钮; 右键菜单增删改; 双击名称重命名 */}
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(NODE_DRAG_MIME)) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setRootDropId(col.id);
                      }
                    }}
                    onDragLeave={() => setRootDropId(undefined)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setRootDropId(undefined);
                      const data = readNodeDrag(e);
                      if (data !== undefined) {
                        moveNode(
                          data.collectionId,
                          data.nodeId,
                          col.id,
                          undefined,
                        );
                      }
                    }}
                    className={cn(
                      "group flex h-7 items-center gap-1 rounded px-1 font-medium text-foreground/80",
                      rootDropId === col.id &&
                        "bg-accent text-accent-foreground ring-1 ring-ring",
                    )}
                  >
                    {editing ? (
                      <InlineRename
                        value={col.name}
                        onCommit={(name) => {
                          renameCollection(col.id, name);
                          setEditingId(undefined);
                        }}
                        onCancel={() => setEditingId(undefined)}
                      />
                    ) : (
                      <>
                        <span
                          className="flex-1 truncate"
                          title="双击重命名"
                          onDoubleClick={() => setEditingId(col.id)}
                        >
                          {col.name}
                        </span>
                        <button
                          type="button"
                          aria-label="运行集合"
                          onClick={() =>
                            setRunnerCollection({ id: col.id, name: col.name })
                          }
                          className="hidden size-5 items-center justify-center rounded text-muted-foreground group-hover:flex hover:text-foreground"
                        >
                          <Play className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="集合变量"
                          onClick={() => toggleExpanded(col.id)}
                          className="hidden size-5 items-center justify-center rounded text-muted-foreground group-hover:flex hover:text-foreground"
                        >
                          <Settings2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="新建文件夹"
                          onClick={() =>
                            addFolder(col.id, undefined, "新文件夹")
                          }
                          className="hidden size-5 items-center justify-center rounded text-muted-foreground group-hover:flex hover:text-foreground"
                        >
                          <FolderPlus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="删除集合"
                          onClick={() => removeCollection(col.id)}
                          className="hidden size-5 items-center justify-center rounded text-muted-foreground group-hover:flex hover:text-foreground"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent
                  className="w-40"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <ContextMenuItem
                    onSelect={() => addFolder(col.id, undefined, "新文件夹")}
                  >
                    <FolderPlus />
                    新建文件夹
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      requestAnimationFrame(() => setEditingId(col.id))
                    }
                  >
                    <Pencil />
                    重命名
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      setRunnerCollection({ id: col.id, name: col.name })
                    }
                  >
                    <Play />
                    运行集合
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => toggleExpanded(col.id)}>
                    <Settings2 />
                    集合变量
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onSelect={() => removeCollection(col.id)}
                  >
                    <Trash2 />
                    删除集合
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {/* 变量编辑区 (展开时显示, 位于节点树之前) */}
              {expandedId === col.id && (
                <div className="flex flex-col gap-1.5 border-t pt-2 pb-1">
                  <span className="px-0.5 text-muted-foreground">集合变量</span>
                  <VariableTable
                    items={col.variables}
                    onChange={(vars) => updateCollectionVariables(col.id, vars)}
                  />
                </div>
              )}

              <CollectionTreeView nodes={col.nodes} handlers={handlers} />
            </div>
          );
        })}
        {collections.length === 0 && (
          <p className="px-1 py-4 text-center text-muted-foreground">
            还没有集合, 新建一个来保存请求
          </p>
        )}
      </div>
    </>
  );
}
