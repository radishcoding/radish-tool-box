import { useEffect, type ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { sortByLength } from "@/lib/sort-by-length";

import { decode } from "../model/codec";
import { HMAC_HASHES, computeHmac } from "../model/hmac";
import { toResultView, type ResultView } from "../model/result-view";
import { CryptoError, type ByteEncoding } from "../model/types";
import { useCryptoStore, type HmacPanelState } from "../store/crypto-store";
import { ByteInput } from "./shared/byte-input";
import { Diagnostics } from "./shared/diagnostics";
import { ResultOutput } from "./shared/result-output";

/**
 * 根据 HMAC 面板状态计算结果视图; 密钥或输入解码失败时回报错误.
 */
async function computeHmacView(
  state: Pick<HmacPanelState, "hashId" | "key" | "input" | "outputEncoding">,
): Promise<ResultView> {
  let key: Uint8Array;
  let data: Uint8Array;
  try {
    key = decode(state.key);
    data = decode(state.input);
  } catch (error) {
    return {
      output: "",
      error: error instanceof CryptoError ? error.message : "输入解码失败",
      diagnostics: [],
    };
  }
  const outcome = await computeHmac(state.hashId, key, data);
  return toResultView(outcome, state.outputEncoding);
}

/**
 * HMAC 面板: 选底层哈希 + 密钥 + 消息, 防抖自动计算.
 */
export function HmacPanel(): ReactElement {
  const hashId = useCryptoStore((state) => state.hmac.hashId);
  const key = useCryptoStore((state) => state.hmac.key);
  const input = useCryptoStore((state) => state.hmac.input);
  const outputEncoding = useCryptoStore((state) => state.hmac.outputEncoding);
  const result = useCryptoStore((state) => state.hmac.result);
  const updateHmac = useCryptoStore((state) => state.updateHmac);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void computeHmacView({
        hashId,
        key,
        input,
        outputEncoding,
      }).then((view) => {
        if (!cancelled) {
          updateHmac({ result: view });
        }
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // result 不入依赖, 避免写回结果触发自身重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hashId,
    key.text,
    key.encoding,
    input.text,
    input.encoding,
    outputEncoding,
    updateHmac,
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2.5">
        <span className="text-sm font-medium text-muted-foreground">HMAC</span>
        <Select
          value={hashId}
          onValueChange={(value) => updateHmac({ hashId: value })}
        >
          <SelectTrigger className="h-7 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByLength(HMAC_HASHES, (h) => h.label).map((hash) => (
              <SelectItem key={hash.id} value={hash.id}>
                {hash.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <ByteInput
          label="密钥 (Key)"
          value={key}
          onChange={(value) => updateHmac({ key: value })}
          placeholder="HMAC 密钥"
        />
        <ByteInput
          label="消息"
          value={input}
          onChange={(value) => updateHmac({ input: value })}
          multiline
          placeholder="待认证的消息"
        />
        <ResultOutput
          label="HMAC"
          value={result}
          encoding={outputEncoding}
          onEncodingChange={(encoding: ByteEncoding) =>
            updateHmac({ outputEncoding: encoding })
          }
        />
        <Diagnostics items={result.diagnostics} />
      </div>
    </div>
  );
}
