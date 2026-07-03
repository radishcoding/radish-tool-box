import { useEffect, type ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { sortByLength } from "@/lib/sort-by-length";

import { decode } from "../model/codec";
import { toResultView, type ResultView } from "../model/result-view";
import {
  SYMMETRIC_ALGORITHMS,
  findSymmetricAlgorithm,
  runSymmetric,
  symmetricNeedsIv,
  type SymmetricMode,
  type SymmetricPadding,
} from "../model/symmetric";
import { CryptoError, type ByteEncoding } from "../model/types";
import {
  useCryptoStore,
  type SymmetricPanelState,
} from "../store/crypto-store";
import { ByteInput } from "./shared/byte-input";
import { Diagnostics } from "./shared/diagnostics";
import { ResultOutput } from "./shared/result-output";

/**
 * 填充选项展示文案.
 */
const PADDING_OPTIONS: ReadonlyArray<{
  readonly value: SymmetricPadding;
  readonly label: string;
}> = [
  { value: "pkcs7", label: "PKCS7" },
  { value: "iso10126", label: "ISO10126" },
  { value: "ansix923", label: "ANSIX923" },
  { value: "zero", label: "Zero" },
  { value: "none", label: "NoPadding" },
];

/**
 * 根据对称面板状态同步计算结果视图; 解码失败回报错误.
 */
function computeSymmetricView(state: SymmetricPanelState): ResultView {
  let key: Uint8Array;
  let iv: Uint8Array;
  let aad: Uint8Array;
  let data: Uint8Array;
  try {
    key = decode(state.key);
    iv = decode(state.iv);
    aad = decode(state.aad);
    data = decode(state.input);
  } catch (error) {
    return {
      output: "",
      error: error instanceof CryptoError ? error.message : "输入解码失败",
      diagnostics: [],
    };
  }
  const outcome = runSymmetric({
    algorithmId: state.algorithmId,
    mode: state.mode,
    padding: state.padding,
    operation: state.operation,
    key,
    iv,
    aad,
    data,
  });
  return toResultView(outcome, state.outputEncoding);
}

/**
 * 对称加密面板: 选算法/方向/模式/填充, 按算法动态显隐 IV/AAD, 防抖自动计算.
 */
export function SymmetricPanel(): ReactElement {
  const state = useCryptoStore((store) => store.symmetric);
  const updateSymmetric = useCryptoStore((store) => store.updateSymmetric);
  const algo = findSymmetricAlgorithm(state.algorithmId);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const view = computeSymmetricView(state);
      if (!cancelled) {
        updateSymmetric({ result: view });
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // result 不入依赖, 避免写回触发自身重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.algorithmId,
    state.mode,
    state.padding,
    state.operation,
    state.key.text,
    state.key.encoding,
    state.iv.text,
    state.iv.encoding,
    state.aad.text,
    state.aad.encoding,
    state.input.text,
    state.input.encoding,
    state.outputEncoding,
    updateSymmetric,
  ]);

  if (!algo) {
    return <div className="p-4 text-sm text-destructive">未知算法</div>;
  }

  const showMode = algo.kind === "block";
  const showPadding = algo.kind === "block";
  const showIv = symmetricNeedsIv(algo, state.mode);
  const showAad = algo.supportsAad;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          对称加密
        </span>
        <Select
          value={state.algorithmId}
          onValueChange={(value) => {
            const next = findSymmetricAlgorithm(value);
            updateSymmetric(
              next && next.modes.length > 0
                ? { algorithmId: value, mode: next.modes[0] }
                : { algorithmId: value },
            );
          }}
        >
          <SelectTrigger className="h-7 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByLength(SYMMETRIC_ALGORITHMS, (i) => i.label).map((item) => (
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
        <ToggleGroup
          type="single"
          value={state.operation}
          onValueChange={(value) => {
            if (value === "encrypt" || value === "decrypt") {
              updateSymmetric({ operation: value });
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="encrypt">加密</ToggleGroupItem>
          <ToggleGroupItem value="decrypt">解密</ToggleGroupItem>
        </ToggleGroup>
        {showMode && (
          <Select
            value={state.mode}
            onValueChange={(value) =>
              updateSymmetric({ mode: value as SymmetricMode })
            }
          >
            <SelectTrigger className="h-7 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {algo.modes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showPadding && (
          <Select
            value={state.padding}
            onValueChange={(value) =>
              updateSymmetric({ padding: value as SymmetricPadding })
            }
          >
            <SelectTrigger className="h-7 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortByLength(PADDING_OPTIONS, (o) => o.label).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <ByteInput
          label="密钥 (Key)"
          value={state.key}
          onChange={(value) => updateSymmetric({ key: value })}
          placeholder="密钥"
        />
        {showIv && (
          <ByteInput
            label="向量 (IV / Nonce)"
            value={state.iv}
            onChange={(value) => updateSymmetric({ iv: value })}
            placeholder="IV 或 Nonce"
          />
        )}
        {showAad && (
          <ByteInput
            label="附加数据 (AAD)"
            value={state.aad}
            onChange={(value) => updateSymmetric({ aad: value })}
            placeholder="可选附加认证数据"
          />
        )}
        <ByteInput
          label={state.operation === "encrypt" ? "明文输入" : "密文输入"}
          value={state.input}
          onChange={(value) => updateSymmetric({ input: value })}
          multiline
          placeholder="待处理数据"
        />
        <ResultOutput
          label={state.operation === "encrypt" ? "密文输出" : "明文输出"}
          value={state.result}
          encoding={state.outputEncoding}
          onEncodingChange={(encoding: ByteEncoding) =>
            updateSymmetric({ outputEncoding: encoding })
          }
        />
        <Diagnostics items={state.result.diagnostics} />
      </div>
    </div>
  );
}
