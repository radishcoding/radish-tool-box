import { EMPTY_RESULT, type ResultView } from "@/lib/outcome";

import { findCodec } from "./registry";
import type { CodecContext, Direction } from "./types";

/**
 * 执行一次编解码, 产出可渲染结果视图.
 * @param codecId 选中的 codec id.
 * @param direction 方向.
 * @param input 输入文本.
 * @param ctx 上下文 (字符集/hex/选项).
 * @returns 结果视图.
 */
export function runCodec(
  codecId: string,
  direction: Direction,
  input: string,
  ctx: CodecContext,
): ResultView {
  const codec = findCodec(codecId);
  if (codec === undefined) {
    return { ...EMPTY_RESULT, error: "未知编解码" };
  }
  if (input === "") {
    return EMPTY_RESULT;
  }
  const outcome =
    direction === "encode"
      ? codec.encode(input, ctx)
      : codec.decode(input, ctx);
  if (outcome.ok) {
    return {
      output: outcome.value,
      error: "",
      diagnostics: [...outcome.diagnostics],
    };
  }
  return {
    output: "",
    error: outcome.error,
    diagnostics: [...outcome.diagnostics],
  };
}
