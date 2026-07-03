import { Code2 } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cancelRequest, sendRequest } from "@/hooks/use-request-execution";

import { flattenScopes } from "../../../../network/variables";
import type { HttpMethod, RequestTab } from "../model/types";
import {
  buildScopesFromStore,
  resolveTemplate,
} from "../model/variable-scopes";
import { useRequestStore } from "../store/request-store";
import { CodegenDialog } from "./codegen-dialog";
import { SaveToCollectionDialog } from "./save-to-collection-dialog";

/**
 * 常用 HTTP 方法.
 */
const METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

/**
 * 地址行: 方法下拉 + URL 输入 + 发送/取消按钮 + 保存.
 * 当 URL 含 {{}} 占位时, 在地址行下方显示变量解析后的完整 URL.
 * @param tab 当前标签.
 */
export function RequestAddressBar({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const response = useRequestStore((s) => s.responses[tab.id]);
  const globals = useRequestStore((s) => s.globals);
  const environments = useRequestStore((s) => s.environments);
  const activeEnvironmentId = useRequestStore((s) => s.activeEnvironmentId);
  const collections = useRequestStore((s) => s.collections);
  const running = response?.phase === "running";
  const [saving, setSaving] = useState(false);
  const [codegen, setCodegen] = useState(false);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
  const collection = collections.find((c) => c.id === tab.collectionId);
  const resolvedUrl = resolveTemplate(
    tab.request.url,
    flattenScopes(
      buildScopesFromStore(globals, activeEnv, collection?.variables ?? []),
    ),
  );
  const hasTemplate = tab.request.url.includes("{{");

  return (
    <div className="flex shrink-0 flex-col border-b">
      <div className="flex items-center gap-2 p-2">
        <Select
          value={tab.request.method}
          onValueChange={(method) => updateRequest(tab.id, { method })}
        >
          <SelectTrigger className="h-8 w-28 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m} value={m} className="font-mono text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={tab.request.url}
          placeholder="https://example.com/api"
          spellCheck={false}
          onChange={(e) => updateRequest(tab.id, { url: e.target.value })}
          className="h-8 flex-1 font-mono text-xs"
        />
        {running ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-20 cursor-pointer"
            onClick={() => cancelRequest(tab.id, response.jobId)}
          >
            取消
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 w-20 cursor-pointer"
            disabled={tab.request.url === ""}
            onClick={() => sendRequest(tab.id, tab.request)}
          >
            发送
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          title="生成代码"
          className="h-8 w-8 cursor-pointer p-0"
          onClick={() => setCodegen(true)}
        >
          <Code2 className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer"
          onClick={() => setSaving(true)}
        >
          保存
        </Button>
        {saving && (
          <SaveToCollectionDialog
            tabId={tab.id}
            defaultName={tab.name}
            onClose={() => setSaving(false)}
          />
        )}
        {codegen && (
          <CodegenDialog
            request={tab.request}
            onClose={() => setCodegen(false)}
          />
        )}
      </div>
      {hasTemplate && (
        <div className="truncate px-3 pb-1.5 font-mono text-[10px] text-muted-foreground">
          解析: {resolvedUrl}
        </div>
      )}
    </div>
  );
}
