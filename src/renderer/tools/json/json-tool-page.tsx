import { type DragEvent, type ReactElement } from "react";

import { Separator } from "@/components/ui/separator";

import { JsonToolbar } from "./components/json-toolbar";
import { JsonWorkspace } from "./components/json-workspace";
import { useDocumentStore } from "./store/document-store";

/**
 * 文档解析 (JSON) 工具页: 工具栏 + 工作区; 支持拖拽打开.
 */
export function JsonToolPage(): ReactElement {
  const openDocument = useDocumentStore((state) => state.openDocument);

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) {
      return;
    }
    void file.text().then((content) => openDocument(content, file.name));
  };

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <JsonToolbar />
      <Separator />
      <div className="min-h-0 flex-1 p-3">
        <JsonWorkspace />
      </div>
    </div>
  );
}
