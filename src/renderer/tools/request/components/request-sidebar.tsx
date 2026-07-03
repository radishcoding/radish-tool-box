import { FolderClosed, Globe, History, Upload } from "lucide-react";
import { useState, type ComponentType, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SidebarSection } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { ImportDialog } from "./import-dialog";
import { SidebarCollections } from "./sidebar-collections";
import { SidebarEnvironments } from "./sidebar-environments";
import { SidebarHistory } from "./sidebar-history";

/**
 * 侧栏分区定义 (id/label/icon).
 */
const SECTIONS: ReadonlyArray<{
  readonly id: SidebarSection;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}> = [
  { id: "collections", label: "集合", icon: FolderClosed },
  { id: "history", label: "历史", icon: History },
  { id: "environments", label: "环境", icon: Globe },
];

/**
 * 左侧栏: 集合/历史/环境分区切换 + 新建请求 + 导入.
 */
export function RequestSidebar(): ReactElement {
  const sidebarSection = useRequestStore((s) => s.sidebarSection);
  const setSidebarSection = useRequestStore((s) => s.setSidebarSection);
  const newTab = useRequestStore((s) => s.newTab);
  const [importing, setImporting] = useState(false);

  return (
    <div className="flex h-full flex-col border-r bg-muted/30">
      <div className="flex shrink-0 items-center gap-1 border-b p-1.5">
        {SECTIONS.map((section) => {
          const active = section.id === sidebarSection;
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant="ghost"
              size="sm"
              onClick={() => setSidebarSection(section.id)}
              className={cn(
                "h-7 flex-1 cursor-pointer gap-1 px-1 text-xs text-muted-foreground transition-colors",
                active
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {section.label}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setImporting(true)}
          title="导入"
          className="h-7 w-7 shrink-0 cursor-pointer p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Upload className="size-3.5" />
        </Button>
      </div>
      <div className="shrink-0 p-2">
        <Button
          size="sm"
          className="w-full cursor-pointer"
          onClick={() => newTab()}
        >
          新建请求
        </Button>
      </div>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      <div className="min-h-0 flex-1 overflow-auto">
        {sidebarSection === "collections" ? (
          <SidebarCollections />
        ) : sidebarSection === "environments" ? (
          <SidebarEnvironments />
        ) : (
          <SidebarHistory />
        )}
      </div>
    </div>
  );
}
