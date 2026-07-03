import { useEffect, useState, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { verifyToken } from "../model/verify";
import type { JwtAlg } from "../model/types";
import { useJwtStore } from "../store/jwt-store";

/**
 * 验签结果的本地状态形状.
 */
interface VerifyState {
  readonly valid: boolean;
  readonly reason: string;
}

/**
 * 验签面板: 密钥输入框 + 实时签名验证徽章.
 * 据 header.alg 自动切换密钥提示; alg 缺失时禁用.
 * @param token 当前待验签的 JWT 紧凑串.
 * @param alg 从 header 解析到的算法, 缺失则不发起验签.
 */
export function JwtVerifyPanel({
  token,
  alg,
}: {
  readonly token: string;
  readonly alg: JwtAlg | undefined;
}): ReactElement {
  const verifyKey = useJwtStore((s) => s.verifyKey);
  const setVerifyKey = useJwtStore((s) => s.setVerifyKey);
  const [state, setState] = useState<VerifyState | undefined>();

  // 防抖 200 ms 实时验签; token/verifyKey/alg 任一变化时重新触发.
  useEffect(() => {
    let cancelled = false;
    if (alg === undefined || token === "" || verifyKey === "") {
      setState(undefined);
      return;
    }
    const timer = setTimeout(() => {
      void verifyToken(token, verifyKey, alg).then((r) => {
        if (cancelled) {
          return;
        }
        setState(r.ok ? r.value : { valid: false, reason: r.error });
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, verifyKey, alg]);

  const placeholder = alg?.startsWith("HS")
    ? "HMAC 密钥 (secret)"
    : "公钥 PEM (SPKI) 或 JWK JSON";

  return (
    <div className="flex flex-col gap-2">
      {/* 标签行 + 验签徽章 */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          验签密钥{alg !== undefined ? ` (${alg})` : ""}
        </span>
        {state !== undefined && (
          <Badge variant={state.valid ? "default" : "destructive"}>
            {state.valid ? "签名有效" : "签名无效"}
          </Badge>
        )}
      </div>

      {/* 密钥输入 */}
      <Textarea
        value={verifyKey}
        onChange={(e) => setVerifyKey(e.target.value)}
        placeholder={alg !== undefined ? placeholder : "先粘贴有效的 JWT"}
        disabled={alg === undefined}
        className="min-h-20 resize-none bg-muted/40 font-mono text-xs"
      />

      {/* 失败原因 */}
      {state !== undefined && !state.valid && (
        <span className="font-mono text-[11px] text-destructive">
          {state.reason}
        </span>
      )}
    </div>
  );
}
