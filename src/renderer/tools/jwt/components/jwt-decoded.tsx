import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { buildClaims } from "../model/claims";
import type { DecodedToken } from "../model/types";

/**
 * 徽章文案; 仅 expired/not-yet 两个非正常状态.
 */
const STATUS_TEXT: Readonly<Record<string, string>> = {
  expired: "已过期",
  "not-yet": "未生效",
};

/**
 * 解码结果展示: Header/Payload 卡片 + Claims 表.
 * @param decoded 已解码的 token 三段.
 * @param nowMs 当前时间 (毫秒), 由调用方注入以便控制.
 */
export function JwtDecoded({
  decoded,
  nowMs,
}: {
  readonly decoded: DecodedToken;
  readonly nowMs: number;
}): ReactElement {
  const claims = buildClaims(decoded.payload, nowMs);

  return (
    <div className="flex flex-col gap-3">
      {/* Header 段 */}
      <Card className="flex flex-col gap-1.5 rounded-xl px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          Header
        </span>
        <pre className="overflow-auto font-mono text-xs leading-relaxed">
          {JSON.stringify(decoded.header, null, 2)}
        </pre>
      </Card>

      {/* Payload 段 */}
      <Card className="flex flex-col gap-1.5 rounded-xl px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          Payload
        </span>
        <pre className="overflow-auto font-mono text-xs leading-relaxed">
          {JSON.stringify(decoded.payload, null, 2)}
        </pre>
      </Card>

      {/* Claims 表 */}
      {claims.length > 0 && (
        <Card className="flex flex-col gap-1 rounded-xl px-4 py-3">
          <span className="mb-1 text-xs font-medium text-muted-foreground">
            Claims
          </span>
          {claims.map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
            >
              <span className="w-36 shrink-0 text-muted-foreground">
                {row.label}
              </span>
              <span className="font-mono">{row.raw}</span>
              {row.note !== undefined && (
                <span className="text-muted-foreground">{row.note}</span>
              )}
              {row.status !== undefined && row.status !== "ok" && (
                <Badge variant="destructive">{STATUS_TEXT[row.status]}</Badge>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
