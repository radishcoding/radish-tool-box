import { Check, Pencil, Plus, Trash2 } from "lucide-react";
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
import { InlineRename } from "./inline-rename";
import { VariableTable } from "./variable-table";

/**
 * 环境分区: 全局变量 + 环境列表 (右键增删改, 内联重命名, 设为活动, 选中编辑变量).
 */
export function SidebarEnvironments(): ReactElement {
  const environments = useRequestStore((s) => s.environments);
  const globals = useRequestStore((s) => s.globals);
  const activeEnvironmentId = useRequestStore((s) => s.activeEnvironmentId);
  const createEnvironment = useRequestStore((s) => s.createEnvironment);
  const deleteEnvironment = useRequestStore((s) => s.deleteEnvironment);
  const setActiveEnvironment = useRequestStore((s) => s.setActiveEnvironment);
  const updateEnvironmentVariables = useRequestStore(
    (s) => s.updateEnvironmentVariables,
  );
  const renameEnvironment = useRequestStore((s) => s.renameEnvironment);
  const updateGlobals = useRequestStore((s) => s.updateGlobals);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const selected = environments.find((e) => e.id === selectedId);

  /**
   * 删除环境并在需要时收起其变量编辑区.
   * @param id 目标环境 id.
   */
  const removeEnvironment = (id: string): void => {
    deleteEnvironment(id);
    if (selectedId === id) {
      setSelectedId(undefined);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-muted-foreground">全局变量</span>
      </div>
      <VariableTable items={globals} onChange={updateGlobals} />

      <div className="mt-2 flex items-center justify-between">
        <span className="font-medium text-muted-foreground">环境</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 cursor-pointer gap-1 text-xs"
          onClick={() => setEditingId(createEnvironment("新环境"))}
        >
          <Plus className="size-3.5" />
          新建
        </Button>
      </div>
      <div className="flex flex-col gap-0.5">
        {environments.map((env) => {
          const active = env.id === activeEnvironmentId;
          const editing = editingId === env.id;
          return (
            <ContextMenu key={env.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-1",
                    env.id === selectedId
                      ? "bg-muted"
                      : active
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    aria-label="设为活动环境"
                    onClick={() =>
                      setActiveEnvironment(active ? undefined : env.id)
                    }
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded",
                      active ? "text-primary" : "text-muted-foreground/40",
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>
                  {editing ? (
                    <InlineRename
                      value={env.name}
                      onCommit={(name) => {
                        renameEnvironment(env.id, name);
                        setEditingId(undefined);
                      }}
                      onCancel={() => setEditingId(undefined)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedId(env.id)}
                      onDoubleClick={() => setEditingId(env.id)}
                      title="双击重命名"
                      className="flex-1 cursor-pointer truncate text-left"
                    >
                      {env.name}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="删除环境"
                    onClick={() => removeEnvironment(env.id)}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent
                className="w-40"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <ContextMenuItem
                  onSelect={() =>
                    setActiveEnvironment(active ? undefined : env.id)
                  }
                >
                  <Check />
                  {active ? "取消活动" : "设为活动"}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => setSelectedId(env.id)}>
                  <Pencil />
                  编辑变量
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() =>
                    requestAnimationFrame(() => setEditingId(env.id))
                  }
                >
                  <Pencil />
                  重命名
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => removeEnvironment(env.id)}
                >
                  <Trash2 />
                  删除
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {selected !== undefined && (
        <div className="mt-2 flex flex-col gap-1.5 border-t pt-2">
          <span className="px-0.5 text-muted-foreground">
            环境变量: {selected.name}
          </span>
          <VariableTable
            items={selected.variables}
            onChange={(vars) => updateEnvironmentVariables(selected.id, vars)}
          />
        </div>
      )}
    </div>
  );
}
