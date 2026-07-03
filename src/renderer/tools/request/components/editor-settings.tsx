import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { RequestSettings, RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { TlsSettingsFields } from "./tls-settings-fields";

/**
 * Settings 子页: 逐请求覆盖 (重定向/超时/SSL/TLS 版本/SNI/CA/客户端证书).
 * @param tab 当前标签.
 */
export function EditorSettings({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const settings = tab.request.settings;
  const patch = (partial: Partial<RequestSettings>): void =>
    updateRequest(tab.id, { settings: { ...settings, ...partial } });

  return (
    <div className="flex flex-col gap-2 p-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">
        <Switch
          checked={settings.followRedirects}
          onCheckedChange={(followRedirects) => patch({ followRedirects })}
        />
        自动跟随重定向
      </label>
      <label className="flex items-center gap-2">
        <span className="w-28 shrink-0">最大重定向次数</span>
        <Input
          type="number"
          value={settings.maxRedirects}
          onChange={(e) => patch({ maxRedirects: Number(e.target.value) })}
          className="h-7 w-24 text-xs"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-28 shrink-0">超时 (毫秒)</span>
        <Input
          type="number"
          value={settings.timeoutMs}
          onChange={(e) => patch({ timeoutMs: Number(e.target.value) })}
          className="h-7 w-28 text-xs"
        />
      </label>
      <TlsSettingsFields settings={settings} onPatch={patch} />
    </div>
  );
}
