import { Copy } from "lucide-react";
import { useState, type ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";

import { signToken } from "../model/sign";
import type { JwtAlg } from "../model/types";
import { useJwtStore } from "../store/jwt-store";

/**
 * 所有支持的算法选项, 按族分组排列.
 */
const ALGS: readonly JwtAlg[] = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
];

/**
 * 签发面板: 算法下拉 + Payload 编辑 + 签发密钥 + 生成按钮 + 结果展示.
 * 密钥绑定 store 的 signKey (不持久化); 生成失败显示红字.
 */
export function JwtSignPanel(): ReactElement {
  const draft = useJwtStore((s) => s.draft);
  const signKey = useJwtStore((s) => s.signKey);
  const updateDraft = useJwtStore((s) => s.updateDraft);
  const setSignKey = useJwtStore((s) => s.setSignKey);

  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /** 点击生成: 调用 signToken, 更新输出或错误. */
  const onSign = (): void => {
    setBusy(true);
    void signToken(draft, signKey).then((r) => {
      setBusy(false);
      if (r.ok) {
        setOutput(r.value);
        setError("");
      } else {
        setOutput("");
        setError(r.error);
      }
    });
  };

  const keyPlaceholder = draft.alg.startsWith("HS")
    ? "HMAC 密钥 (secret)"
    : "私钥 PEM (PKCS8) 或 JWK JSON";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto rounded-xl border bg-card p-4">
      {/* 算法选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">算法</span>
        <Select
          value={draft.alg}
          onValueChange={(v) => updateDraft({ alg: v as JwtAlg })}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALGS.map((a) => (
              <SelectItem key={a} value={a} className="text-xs font-mono">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 额外 Header 字段 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          额外 Header (JSON, 可选)
        </span>
        <Textarea
          value={draft.headerExtra}
          onChange={(e) => updateDraft({ headerExtra: e.target.value })}
          placeholder="额外 Header (JSON, 可选)"
          className="min-h-16 resize-none bg-muted/40 font-mono text-xs"
        />
      </div>

      {/* Payload 编辑 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Payload (JSON)
        </span>
        <Textarea
          value={draft.payload}
          onChange={(e) => updateDraft({ payload: e.target.value })}
          placeholder='{"sub": "1234567890"}'
          className="min-h-28 resize-none bg-muted/40 font-mono text-xs"
        />
      </div>

      {/* 签发密钥 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          签发密钥
        </span>
        <Textarea
          value={signKey}
          onChange={(e) => setSignKey(e.target.value)}
          placeholder={keyPlaceholder}
          className="min-h-20 resize-none bg-muted/40 font-mono text-xs"
        />
      </div>

      {/* 生成按钮 */}
      <div className="flex justify-end">
        <Button
          size="sm"
          className="w-[120px] cursor-pointer"
          onClick={onSign}
          disabled={busy}
        >
          {busy ? "生成中..." : "生成"}
        </Button>
      </div>

      {/* 错误提示 */}
      {error !== "" && (
        <span className="font-mono text-[11px] text-destructive">{error}</span>
      )}

      {/* 结果展示 + 复制 */}
      {output !== "" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              生成结果
            </span>
            <IconAction
              icon={Copy}
              label="复制 token"
              onClick={() => void copyText(output)}
            />
          </div>
          <Textarea
            value={output}
            readOnly
            className="min-h-20 resize-none bg-muted/40 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}
