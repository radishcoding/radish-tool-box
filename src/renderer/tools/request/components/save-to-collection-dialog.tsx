import { useMemo, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { findRequestByName, flattenFolders } from "../model/collection-tree";
import { useRequestStore } from "../store/request-store";

/** "根目录" 选项的哨兵值 (Select 不接受空串 value). */
const ROOT_VALUE = "__root__";

/** 同名冲突时待确认覆盖的目标信息. */
interface OverwriteTarget {
  readonly collectionId: string;
  readonly nodeId: string;
}

/**
 * 保存请求到集合的弹层: 选目标集合 + 命名 + 确认.
 * @param tabId 待保存的标签 id.
 * @param defaultName 默认请求名.
 * @param onClose 关闭回调.
 */
export function SaveToCollectionDialog({
  tabId,
  defaultName,
  onClose,
}: {
  readonly tabId: string;
  readonly defaultName: string;
  readonly onClose: () => void;
}): ReactElement {
  const collections = useRequestStore((s) => s.collections);
  const createCollection = useRequestStore((s) => s.createCollection);
  const saveTabToCollection = useRequestStore((s) => s.saveTabToCollection);
  const overwriteSavedRequest = useRequestStore((s) => s.overwriteSavedRequest);
  // 当前标签的来源节点 id: 原地重存 (未改名换位) 时直接覆盖, 不提示.
  const originNodeId = useRequestStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.nodeId,
  );
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  // 目标文件夹 id; ROOT_VALUE 表示集合根.
  const [folderId, setFolderId] = useState(ROOT_VALUE);
  const [name, setName] = useState(
    defaultName === "" ? "未命名请求" : defaultName,
  );
  // 非 undefined 时展示覆盖确认面板 (存在他处同名请求).
  const [overwrite, setOverwrite] = useState<OverwriteTarget | undefined>(
    undefined,
  );

  // 当前所选集合下的全部文件夹 (展平为路径标签).
  const folders = useMemo(() => {
    const target = collections.find((c) => c.id === collectionId);
    return target ? flattenFolders(target.nodes) : [];
  }, [collections, collectionId]);

  /**
   * 切换目标集合时重置文件夹为根 (旧文件夹不属于新集合).
   * @param value 新集合 id.
   */
  const changeCollection = (value: string): void => {
    setCollectionId(value);
    setFolderId(ROOT_VALUE);
  };

  const confirm = (): void => {
    // 未选集合: 新建一个空集合直接存入根, 无同名可能.
    if (collectionId === "") {
      const targetId = createCollection("新集合");
      if (targetId !== "") {
        saveTabToCollection(tabId, targetId, undefined, name);
      }
      onClose();
      return;
    }
    const parentId = folderId === ROOT_VALUE ? undefined : folderId;
    const target = collections.find((c) => c.id === collectionId);
    const duplicate = target
      ? findRequestByName(target.nodes, parentId, name)
      : undefined;
    if (duplicate !== undefined && duplicate.id !== originNodeId) {
      // 他处已有同名请求: 先弹覆盖确认, 由用户决定.
      setOverwrite({ collectionId, nodeId: duplicate.id });
      return;
    }
    if (duplicate !== undefined) {
      // 同一来源节点原地重存, 直接覆盖.
      overwriteSavedRequest(tabId, collectionId, duplicate.id, name);
      onClose();
      return;
    }
    saveTabToCollection(tabId, collectionId, parentId, name);
    onClose();
  };

  const confirmOverwrite = (): void => {
    if (overwrite !== undefined) {
      overwriteSavedRequest(
        tabId,
        overwrite.collectionId,
        overwrite.nodeId,
        name,
      );
    }
    onClose();
  };

  if (overwrite !== undefined) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="覆盖同名请求"
      >
        <div
          className="flex w-80 flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-sm font-medium">已存在同名请求</span>
          <p className="text-xs text-muted-foreground">
            目标位置已有请求 "{name}", 覆盖将替换其内容, 此操作不可撤销.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={() => setOverwrite(undefined)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="cursor-pointer"
              onClick={confirmOverwrite}
            >
              覆盖
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="保存到集合"
    >
      <div
        className="flex w-80 flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium">保存到集合</span>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          请求名
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          目标集合
          <Select value={collectionId} onValueChange={changeCollection}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="新建集合" />
            </SelectTrigger>
            <SelectContent>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          目标文件夹
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT_VALUE} className="text-xs">
                (集合根目录)
              </SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={onClose}
          >
            取消
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={confirm}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
