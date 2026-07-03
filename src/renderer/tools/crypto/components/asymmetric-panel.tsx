import { useEffect, type ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { sortByLength } from "@/lib/sort-by-length";

import { decode } from "../model/codec";
import { generateAsymKeypair } from "../model/keypair";
import { runAsym } from "../model/asymmetric";
import {
  ASYM_ALGORITHMS,
  findAsymAlgorithm,
  type AsymOperation,
} from "../model/asym-types";
import { EMPTY_RESULT, toResultView } from "../model/result-view";
import { CryptoError, type ByteEncoding } from "../model/types";
import { useCryptoStore, type AsymPanelState } from "../store/crypto-store";
import { ByteInput } from "./shared/byte-input";
import { Diagnostics } from "./shared/diagnostics";
import { ExecuteButton } from "./shared/execute-button";
import { ResultOutput } from "./shared/result-output";

/**
 * 操作子模式中文标签.
 */
const OPERATION_LABEL: Readonly<Record<AsymOperation, string>> = {
  encrypt: "加密",
  decrypt: "解密",
  sign: "签名",
  verify: "验签",
  derive: "密钥协商",
};

/**
 * 运行非对称操作并把结果落到 store (区分 字节/布尔 结果).
 * @param state 当前面板状态.
 * @param update 状态更新函数.
 */
function applyAsym(
  state: AsymPanelState,
  update: (patch: Partial<AsymPanelState>) => void,
): void {
  let data: Uint8Array;
  let signature: Uint8Array;
  try {
    data = decode(state.input);
    signature = decode(state.signature);
  } catch (error) {
    update({
      result: {
        output: "",
        error: error instanceof CryptoError ? error.message : "输入解码失败",
        diagnostics: [],
      },
      verifyResult: "none",
    });
    return;
  }
  const outcome = runAsym({
    algorithmId: state.algorithmId,
    operation: state.operation,
    variant: state.variant,
    scheme: state.scheme,
    publicKey: state.publicKey,
    privateKey: state.privateKey,
    data,
    signature,
  });
  if (outcome.ok && outcome.value.kind === "boolean") {
    update({
      verifyResult: outcome.value.value ? "valid" : "invalid",
      result: { output: "", error: "", diagnostics: [] },
    });
    return;
  }
  if (outcome.ok && outcome.value.kind === "bytes") {
    update({
      result: toResultView(
        { ok: true, value: outcome.value.value, diagnostics: [] },
        state.outputEncoding,
      ),
      verifyResult: "none",
    });
    return;
  }
  update({
    result: {
      output: "",
      error: outcome.ok ? "" : outcome.error,
      diagnostics: outcome.ok ? [] : outcome.diagnostics,
    },
    verifyResult: "none",
  });
}

/**
 * 非对称面板: 选算法/操作/变体/方案, 管理公私钥, 自动计算; 密钥对生成走按钮.
 */
export function AsymmetricPanel(): ReactElement {
  const state = useCryptoStore((store) => store.asym);
  const updateAsym = useCryptoStore((store) => store.updateAsym);
  const algo = findAsymAlgorithm(state.algorithmId);

  useEffect(() => {
    const timer = setTimeout(() => applyAsym(state, updateAsym), 150);
    return () => clearTimeout(timer);
    // result/verifyResult/running 不入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.algorithmId,
    state.operation,
    state.variant,
    state.scheme,
    state.publicKey,
    state.privateKey,
    state.input.text,
    state.input.encoding,
    state.signature.text,
    state.signature.encoding,
    state.outputEncoding,
    updateAsym,
  ]);

  if (!algo) {
    return <div className="p-4 text-sm text-destructive">未知算法</div>;
  }

  const onGenerate = (): void => {
    updateAsym({ running: true });
    void generateAsymKeypair(state.algorithmId, state.variant)
      .then((outcome) => {
        if (outcome.ok) {
          updateAsym({
            publicKey: outcome.value.publicKey,
            privateKey: outcome.value.privateKey,
            running: false,
          });
        } else {
          updateAsym({
            running: false,
            result: { output: "", error: outcome.error, diagnostics: [] },
          });
        }
      })
      .catch((e: unknown) =>
        updateAsym({
          running: false,
          result: {
            output: "",
            error: e instanceof Error ? e.message : "密钥生成失败",
            diagnostics: [],
          },
        }),
      );
  };

  const needsSignature = state.operation === "verify";
  const showScheme = algo.schemes.length > 0;
  const showVariant = algo.variants.length > 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          非对称
        </span>
        <Select
          value={state.algorithmId}
          onValueChange={(value) => {
            const next = findAsymAlgorithm(value);
            updateAsym({
              algorithmId: value,
              operation: next ? next.operations[0] : "sign",
              variant:
                next && next.variants.length > 0 ? next.variants[0].id : "",
              scheme: next && next.schemes.length > 0 ? next.schemes[0].id : "",
              verifyResult: "none",
              result: EMPTY_RESULT,
            });
          }}
        >
          <SelectTrigger className="h-7 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByLength(ASYM_ALGORITHMS, (i) => i.label).map((item) => (
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
        <Select
          value={state.operation}
          onValueChange={(value) =>
            updateAsym({ operation: value as AsymOperation })
          }
        >
          <SelectTrigger className="h-7 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByLength(algo.operations, (op) => OPERATION_LABEL[op]).map(
              (op) => (
                <SelectItem key={op} value={op}>
                  {OPERATION_LABEL[op]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        {showVariant && (
          <Select
            value={state.variant}
            onValueChange={(value) => updateAsym({ variant: value })}
          >
            <SelectTrigger className="h-7 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortByLength(algo.variants, (v) => v.label).map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {variant.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showScheme && (
          <Select
            value={state.scheme}
            onValueChange={(value) => updateAsym({ scheme: value })}
          >
            <SelectTrigger className="h-7 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortByLength(algo.schemes, (s) => s.label).map((scheme) => (
                <SelectItem key={scheme.id} value={scheme.id}>
                  {scheme.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ExecuteButton
          running={state.running}
          onExecute={onGenerate}
          label="生成密钥对"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              公钥 ({algo.keyEncoding.toUpperCase()})
            </span>
            <Textarea
              value={state.publicKey}
              onChange={(event) =>
                updateAsym({ publicKey: event.target.value })
              }
              className="min-h-24 font-mono text-xs"
              placeholder="公钥"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              私钥 ({algo.keyEncoding.toUpperCase()})
            </span>
            <Textarea
              value={state.privateKey}
              onChange={(event) =>
                updateAsym({ privateKey: event.target.value })
              }
              className="min-h-24 font-mono text-xs"
              placeholder="私钥"
            />
          </label>
        </div>

        <ByteInput
          label="输入数据"
          value={state.input}
          onChange={(value) => updateAsym({ input: value })}
          multiline
          placeholder="待处理数据"
        />
        {needsSignature && (
          <ByteInput
            label="签名 (待验证)"
            value={state.signature}
            onChange={(value) => updateAsym({ signature: value })}
            placeholder="签名字节"
          />
        )}

        {state.operation === "verify" ? (
          <div className="rounded-md border px-2.5 py-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              验签结果
            </span>
            <span className="ml-2">
              {state.verifyResult === "valid" && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  通过
                </span>
              )}
              {state.verifyResult === "invalid" && (
                <span className="text-destructive">不通过</span>
              )}
              {state.verifyResult === "none" && (
                <span className="text-muted-foreground">待输入</span>
              )}
            </span>
            {state.result.error !== "" && (
              <p className="mt-1 text-xs text-destructive">
                {state.result.error}
              </p>
            )}
          </div>
        ) : (
          <ResultOutput
            label="结果"
            value={state.result}
            encoding={state.outputEncoding}
            onEncodingChange={(encoding: ByteEncoding) =>
              updateAsym({ outputEncoding: encoding })
            }
          />
        )}
        <Diagnostics items={state.result.diagnostics} />
      </div>
    </div>
  );
}
