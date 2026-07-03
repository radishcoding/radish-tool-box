import type { HexOptions } from "@/lib/charset/hex";
import type { Outcome } from "@/lib/outcome";

/**
 * 编解码方向.
 */
export type Direction = "encode" | "decode";

/**
 * 编解码族.
 */
export type CodecGroup =
  | "binary"
  | "web"
  | "escape"
  | "number"
  | "transport"
  | "fun";

/**
 * 单个专属选项声明 (工作区据此渲染控件, 当前值进 ctx.options).
 * kind 缺省为 "select" (下拉, 用 choices); "text" 时渲染文本输入 (用 placeholder).
 */
export interface CodecChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly kind?: "select" | "text";
  readonly choices?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly placeholder?: string;
  readonly defaultValue: string;
}

/**
 * 编解码上下文: 由工作区按当前选项装配, 传入 encode/decode.
 */
export interface CodecContext {
  readonly charset: string;
  readonly hex: HexOptions;
  readonly options: Readonly<Record<string, string>>;
}

/**
 * 单个编解码项定义.
 */
export interface CodecDef {
  readonly id: string;
  readonly label: string;
  readonly group: CodecGroup;
  readonly needsCharset: boolean;
  readonly options?: readonly CodecChoiceOption[];
  readonly encode: (input: string, ctx: CodecContext) => Outcome<string>;
  readonly decode: (input: string, ctx: CodecContext) => Outcome<string>;
}
