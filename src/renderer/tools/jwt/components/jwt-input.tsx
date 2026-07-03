import type { ReactElement } from "react";

import { Textarea } from "@/components/ui/textarea";

import { useJwtStore } from "../store/jwt-store";

/**
 * JWT 输入框: 绑定 store 的 token/setToken, 供解码 Tab 顶部使用.
 */
export function JwtInput(): ReactElement {
  const token = useJwtStore((s) => s.token);
  const setToken = useJwtStore((s) => s.setToken);

  return (
    <Textarea
      value={token}
      onChange={(e) => setToken(e.target.value)}
      placeholder="粘贴 JWT..."
      className="min-h-24 resize-none bg-muted/40 font-mono text-xs"
    />
  );
}
