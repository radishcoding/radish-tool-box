import type { ReactElement } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { RequestTab } from "../model/types";
import { EditorAuth } from "./editor-auth";
import { EditorBody } from "./editor-body";
import { EditorHeaders } from "./editor-headers";
import { EditorParams } from "./editor-params";
import { EditorScripts } from "./editor-scripts";
import { EditorSettings } from "./editor-settings";
import { RequestAddressBar } from "./request-address-bar";

/**
 * 统计启用项数 (用于子页标题徽章).
 */
function enabledCount(items: readonly { readonly enabled: boolean }[]): string {
  const n = items.filter((i) => i.enabled).length;
  return n > 0 ? ` (${n})` : "";
}

/**
 * HTTP 编辑区: 地址行 + 子页 (Params/Auth/Headers/Body/Scripts/Settings).
 * @param tab 当前标签.
 */
export function HttpEditor({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  return (
    <div className="flex min-h-0 flex-col">
      <RequestAddressBar tab={tab} />
      <Tabs defaultValue="params" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-9 shrink-0 justify-start rounded-none border-b bg-transparent px-2">
          <TabsTrigger value="params" className="text-xs">
            Params{enabledCount(tab.request.params)}
          </TabsTrigger>
          <TabsTrigger value="auth" className="text-xs">
            Auth
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers{enabledCount(tab.request.headers)}
          </TabsTrigger>
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="scripts" className="text-xs">
            Scripts
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">
            Settings
          </TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-auto">
          <TabsContent value="params">
            <EditorParams tab={tab} />
          </TabsContent>
          <TabsContent value="auth">
            <EditorAuth tab={tab} />
          </TabsContent>
          <TabsContent value="headers">
            <EditorHeaders tab={tab} />
          </TabsContent>
          <TabsContent value="body">
            <EditorBody tab={tab} />
          </TabsContent>
          <TabsContent value="scripts">
            <EditorScripts tab={tab} />
          </TabsContent>
          <TabsContent value="settings">
            <EditorSettings tab={tab} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
