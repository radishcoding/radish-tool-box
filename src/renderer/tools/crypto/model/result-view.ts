import { encode } from "./codec";
import type { ByteEncoding } from "./types";
import type { Outcome, ResultView } from "@/lib/outcome";

export type { ResultView } from "@/lib/outcome";
export { EMPTY_RESULT } from "@/lib/outcome";

/**
 * 把字节结果按编码转为可渲染视图; 失败时输出为空并带错误原因.
 * @param outcome model 计算结果.
 * @param encoding 输出文本编码.
 */
export function toResultView(
  outcome: Outcome<Uint8Array>,
  encoding: ByteEncoding,
): ResultView {
  if (!outcome.ok) {
    return {
      output: "",
      error: outcome.error,
      diagnostics: outcome.diagnostics,
    };
  }
  return {
    output: encode(outcome.value, encoding),
    error: "",
    diagnostics: outcome.diagnostics,
  };
}
