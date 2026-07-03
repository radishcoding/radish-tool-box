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
import { HASH_ALGORITHMS, computeHash } from "../model/hash";
import { toResultView, type ResultView } from "../model/result-view";
import { CryptoError, type ByteEncoding } from "../model/types";
import { useCryptoStore, type HashPanelState } from "../store/crypto-store";
import { ByteInput } from "./shared/byte-input";
import { Diagnostics } from "./shared/diagnostics";
import { ResultOutput } from "./shared/result-output";

/**
 * 根据哈希面板状态计算结果视图; 输入解码失败时回报错误.
 */
async function computeHashView(
  state: Pick<HashPanelState, "algorithmId" | "input" | "outputEncoding">,
): Promise<ResultView> {
  let data: Uint8Array;
  try {
    data = decode(state.input);
  } catch (error) {
    return {
      output: "",
      error: error instanceof CryptoError ? error.message : "输入解码失败",
      diagnostics: [],
    };
  }
  const outcome = await computeHash(state.algorithmId, data);
  return toResultView(outcome, state.outputEncoding);
}

/**
 * 哈希/摘要面板: 选算法 + 输入数据, 防抖自动计算摘要.
 */
export function HashPanel(): ReactElement {
  const algorithmId = useCryptoStore((state) => state.hash.algorithmId);
  const input = useCryptoStore((state) => state.hash.input);
  const outputEncoding = useCryptoStore((state) => state.hash.outputEncoding);
  const result = useCryptoStore((state) => state.hash.result);
  const updateHash = useCryptoStore((state) => state.updateHash);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void computeHashView({
        algorithmId,
        input,
        outputEncoding,
      }).then((view) => {
        if (!cancelled) {
          updateHash({ result: view });
        }
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // result 不入依赖, 避免写回结果触发自身重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithmId, input.text, input.encoding, outputEncoding, updateHash]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          哈希 / 摘要
        </span>
        <Select
          value={algorithmId}
          onValueChange={(value) => updateHash({ algorithmId: value })}
        >
          <SelectTrigger className="h-7 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByLength(HASH_ALGORITHMS, (a) => a.label).map((algo) => (
              <SelectItem
                key={algo.id}
                value={algo.id}
                disabled={!algo.available}
              >
                {algo.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <ByteInput
          label="输入数据"
          value={input}
          onChange={(value) => updateHash({ input: value })}
          multiline
          placeholder="待计算的数据"
        />
        <ResultOutput
          label="摘要"
          value={result}
          encoding={outputEncoding}
          onEncodingChange={(encoding: ByteEncoding) =>
            updateHash({ outputEncoding: encoding })
          }
        />
        <Diagnostics items={result.diagnostics} />
      </div>
    </div>
  );
}
