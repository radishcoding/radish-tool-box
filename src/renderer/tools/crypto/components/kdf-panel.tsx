import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { sortByLength } from "@/lib/sort-by-length";

import { decode } from "../model/codec";
import {
  KDF_ALGORITHMS,
  KDF_HASHES,
  computeKdf,
  findKdfAlgorithm,
  kdfDefaults,
  type KdfField,
} from "../model/kdf";
import { toResultView, type ResultView } from "../model/result-view";
import { CryptoError, type ByteEncoding } from "../model/types";
import { useCryptoStore, type KdfPanelState } from "../store/crypto-store";
import { ByteInput } from "./shared/byte-input";
import { Diagnostics } from "./shared/diagnostics";
import { ExecuteButton } from "./shared/execute-button";
import { ResultOutput } from "./shared/result-output";

/**
 * 数值字段的中文标签.
 */
const FIELD_LABEL: Readonly<Record<KdfField, string>> = {
  hash: "哈希",
  iterations: "迭代次数",
  info: "Info",
  cost: "Cost",
  blockSize: "块大小 r",
  parallelism: "并行度 p",
  memorySize: "内存 (KiB)",
  hashLength: "输出长度 (字节)",
};

/**
 * 数值字段到状态键的映射 (仅数值字段).
 */
const NUMBER_FIELD_KEYS: ReadonlyArray<{
  readonly field: KdfField;
  readonly key:
    | "iterations"
    | "cost"
    | "blockSize"
    | "parallelism"
    | "memorySize"
    | "hashLength";
}> = [
  { field: "iterations", key: "iterations" },
  { field: "cost", key: "cost" },
  { field: "blockSize", key: "blockSize" },
  { field: "parallelism", key: "parallelism" },
  { field: "memorySize", key: "memorySize" },
  { field: "hashLength", key: "hashLength" },
];

/**
 * 根据 KDF 面板状态执行计算; 解码失败回报错误.
 */
async function computeKdfView(state: KdfPanelState): Promise<ResultView> {
  let password: Uint8Array;
  let salt: Uint8Array;
  let info: Uint8Array;
  try {
    password = decode(state.password);
    salt = decode(state.salt);
    info = decode(state.info);
  } catch (error) {
    return {
      output: "",
      error: error instanceof CryptoError ? error.message : "输入解码失败",
      diagnostics: [],
    };
  }
  const outcome = await computeKdf({
    algorithmId: state.algorithmId,
    hashId: state.hashId,
    password,
    salt,
    info,
    iterations: state.iterations,
    cost: state.cost,
    blockSize: state.blockSize,
    parallelism: state.parallelism,
    memorySize: state.memorySize,
    hashLength: state.hashLength,
  });
  return toResultView(outcome, state.outputEncoding);
}

/**
 * KDF/口令哈希面板: 选算法与参数, 手动执行 (重型算法不自动计算).
 */
export function KdfPanel(): ReactElement {
  const state = useCryptoStore((store) => store.kdf);
  const updateKdf = useCryptoStore((store) => store.updateKdf);
  const algo = findKdfAlgorithm(state.algorithmId);

  const onExecute = (): void => {
    updateKdf({ running: true });
    void computeKdfView(state)
      .then((view) => updateKdf({ result: view, running: false }))
      .catch((e: unknown) =>
        updateKdf({
          running: false,
          result: {
            output: "",
            error: e instanceof Error ? e.message : "执行失败",
            diagnostics: [],
          },
        }),
      );
  };

  if (!algo) {
    return <div className="p-4 text-sm text-destructive">未知算法</div>;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          KDF / 口令哈希
        </span>
        <Select
          value={state.algorithmId}
          onValueChange={(value) =>
            updateKdf({ algorithmId: value, ...kdfDefaults(value) })
          }
        >
          <SelectTrigger className="h-7 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByLength(KDF_ALGORITHMS, (i) => i.label).map((item) => (
              <SelectItem
                key={item.id}
                value={item.id}
                disabled={!item.available}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExecuteButton running={state.running} onExecute={onExecute} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="flex flex-wrap items-end gap-3">
          {algo.fields.includes("hash") && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {FIELD_LABEL.hash}
              </span>
              <Select
                value={state.hashId}
                onValueChange={(value) => updateKdf({ hashId: value })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortByLength(KDF_HASHES, (h) => h.label).map((hash) => (
                    <SelectItem key={hash.id} value={hash.id}>
                      {hash.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          {NUMBER_FIELD_KEYS.filter(({ field }) =>
            algo.fields.includes(field),
          ).map(({ field, key }) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {FIELD_LABEL[field]}
              </span>
              <Input
                type="number"
                min="0"
                className="w-32"
                value={String(state[key])}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  updateKdf({ [key]: Number.isFinite(parsed) ? parsed : 0 });
                }}
              />
            </label>
          ))}
        </div>

        <ByteInput
          label="口令 / 密钥材料"
          value={state.password}
          onChange={(value) => updateKdf({ password: value })}
          placeholder="password"
        />
        <ByteInput
          label="盐 (Salt)"
          value={state.salt}
          onChange={(value) => updateKdf({ salt: value })}
          placeholder="salt"
        />
        {algo.fields.includes("info") && (
          <ByteInput
            label="Info"
            value={state.info}
            onChange={(value) => updateKdf({ info: value })}
            placeholder="HKDF info"
          />
        )}
        <ResultOutput
          label="派生结果"
          value={state.result}
          encoding={state.outputEncoding}
          onEncodingChange={(encoding: ByteEncoding) =>
            updateKdf({ outputEncoding: encoding })
          }
        />
        <Diagnostics items={state.result.diagnostics} />
      </div>
    </div>
  );
}
