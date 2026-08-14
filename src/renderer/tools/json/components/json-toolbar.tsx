import {
  ChevronDown,
  ClipboardPaste,
  Columns2,
  Eraser,
  ExternalLink,
  FolderOpen,
  Plus,
  X,
} from "lucide-react";
import { useState, type ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { useDocumentStore } from "../store/document-store";

/**
 * JSON 工具栏: 多文档标签 + 操作 (粘贴/打开/格式/转换/对比/弹出).
 */
export function JsonToolbar(): ReactElement {
  const documents = useDocumentStore((state) => state.documents);
  const activeId = useDocumentStore((state) => state.activeId);
  const setActiveDocument = useDocumentStore(
    (state) => state.setActiveDocument,
  );
  const newDocument = useDocumentStore((state) => state.newDocument);
  const closeDocument = useDocumentStore((state) => state.closeDocument);
  const setText = useDocumentStore((state) => state.setText);
  const formatDocument = useDocumentStore((state) => state.formatDocument);
  const minifyDocument = useDocumentStore((state) => state.minifyDocument);
  const sortKeysDocument = useDocumentStore((state) => state.sortKeysDocument);
  const escapeDocument = useDocumentStore((state) => state.escapeDocument);
  const unescapeDocument = useDocumentStore((state) => state.unescapeDocument);
  const clearDocument = useDocumentStore((state) => state.clearDocument);
  const expandAll = useDocumentStore((state) => state.expandAll);
  const openDocument = useDocumentStore((state) => state.openDocument);
  const compare = useDocumentStore((state) => state.compare);
  const toggleCompare = useDocumentStore((state) => state.toggleCompare);
  const serializeSession = useDocumentStore((state) => state.serializeSession);

  const [recent, setRecent] = useState<readonly string[]>([]);

  const refreshRecent = (): void => {
    void window.fileApi.getRecent().then(setRecent);
  };

  const handleOpen = async (): Promise<void> => {
    const file = await window.fileApi.open();
    if (file) {
      openDocument(file.content, file.name);
      refreshRecent();
    }
  };

  const handleOpenRecent = async (filePath: string): Promise<void> => {
    const file = await window.fileApi.read(filePath);
    if (file) {
      openDocument(file.content, file.name);
      refreshRecent();
    }
  };

  const baseName = (filePath: string): string =>
    filePath.split(/[\\/]/).pop() ?? filePath;

  const handlePaste = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      setText(activeId, text);
      formatDocument(activeId);
      expandAll(activeId);
    } catch {
      // 忽略剪贴板读取失败
    }
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
      <div className="flex min-w-0 items-center gap-1">
        <Tabs value={activeId} onValueChange={setActiveDocument}>
          <TabsList>
            {documents.map((doc) => (
              <TabsTrigger key={doc.id} value={doc.id} className="gap-1">
                <span className="max-w-32 truncate">{doc.title}</span>
                {documents.length > 1 && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="关闭文档"
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm",
                      "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      closeDocument(doc.id);
                    }}
                  >
                    <X className="size-3" />
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <IconAction icon={Plus} label="新建文档" onClick={newDocument} />
      </div>
      <div className="flex items-center gap-1">
        <IconAction
          icon={ClipboardPaste}
          label="粘贴"
          onClick={() => void handlePaste()}
        />
        <IconAction
          icon={Eraser}
          label="清空"
          onClick={() => clearDocument(activeId)}
        />
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) {
              refreshRecent();
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="打开文件"
            >
              <FolderOpen className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void handleOpen()}>
              打开文件...
            </DropdownMenuItem>
            {recent.length > 0 && <DropdownMenuSeparator />}
            {recent.map((filePath) => (
              <DropdownMenuItem
                key={filePath}
                onSelect={() => void handleOpenRecent(filePath)}
              >
                <span className="max-w-60 truncate">{baseName(filePath)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-5!" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
            >
              格式
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => formatDocument(activeId)}>
              格式化
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => minifyDocument(activeId)}>
              压缩
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => sortKeysDocument(activeId)}>
              按键排序
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
            >
              转换
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => escapeDocument(activeId)}>
              转义为字符串
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => unescapeDocument(activeId)}>
              去转义
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-5!" />
        <IconAction
          icon={Columns2}
          label="对比视图"
          active={compare}
          onClick={toggleCompare}
        />
        <IconAction
          icon={ExternalLink}
          label="弹出独立窗口"
          onClick={() => window.windowControls.popout(serializeSession())}
        />
      </div>
    </div>
  );
}
