import { create } from "zustand";

import { EMPTY_RESULT, type ResultView } from "@/lib/outcome";

import { DEFAULT_CHARSET } from "../model/charsets";
import type { Form, HexOptions, SideState } from "../model/types";

/**
 * 编码转换工具的持久化形状 (不含动作与结果).
 */
export interface EncodingPersisted {
  readonly source: SideState;
  readonly targetForm: Form;
  readonly targetCharset: string;
  readonly strict: boolean;
  readonly hex: HexOptions;
}

/**
 * 编码转换工具的全局状态 (持久化字段 + 结果 + 所有动作).
 */
interface EncodingState extends EncodingPersisted {
  readonly result: ResultView;
  /** 更新源侧字段 (部分合并). */
  readonly updateSource: (patch: Partial<SideState>) => void;
  /** 设置目标形态. */
  readonly setTargetForm: (form: Form) => void;
  /** 设置目标字符集. */
  readonly setTargetCharset: (charset: string) => void;
  /** 设置严格模式开关. */
  readonly setStrict: (strict: boolean) => void;
  /** 更新 Hex 显示选项 (部分合并). */
  readonly setHex: (patch: Partial<HexOptions>) => void;
  /**
   * 对调源与目标: 源侧形态/字符集/内容 <-> 目标形态/字符集.
   * 新源内容取自当前 result.output.
   */
  readonly swap: () => void;
  /** 写入转换结果. */
  readonly setResult: (result: ResultView) => void;
  /**
   * 序列化为可持久化形状; 不含 result.
   * @returns 持久化快照.
   */
  readonly serialize: () => EncodingPersisted;
  /**
   * 将持久化数据浅合并进 store; 非对象输入安全忽略.
   * @param raw 反序列化后的原始值 (来源不可信).
   */
  readonly hydrate: (raw: unknown) => void;
}

/**
 * 源侧初始态.
 */
const INITIAL_SOURCE: SideState = {
  form: "text",
  charset: DEFAULT_CHARSET,
  text: "",
};

/**
 * Hex 选项初始态.
 */
const INITIAL_HEX: HexOptions = { upperCase: false, format: "none" };

/**
 * 旧版分隔符字段到新 format 的迁移映射 (向后兼容旧持久化数据).
 */
const LEGACY_SEPARATOR_TO_FORMAT: Readonly<
  Record<string, HexOptions["format"]>
> = {
  "": "none",
  " ": "space",
  "-": "dash",
};

/**
 * 把持久化的 Hex 选项合并进当前态, 兼容旧版仅有 separator 字段的数据.
 * @param current 当前 Hex 选项.
 * @param saved 持久化中的 Hex 选项 (可能是旧形状).
 * @returns 合并后的 Hex 选项.
 */
function mergeHex(
  current: HexOptions,
  saved: Partial<HexOptions> & { readonly separator?: string },
): HexOptions {
  const format =
    saved.format ??
    (saved.separator !== undefined
      ? LEGACY_SEPARATOR_TO_FORMAT[saved.separator]
      : undefined) ??
    current.format;
  return { upperCase: saved.upperCase ?? current.upperCase, format };
}

/**
 * 编码转换工具 store.
 */
export const useEncodingStore = create<EncodingState>((set, get) => ({
  source: INITIAL_SOURCE,
  targetForm: "hex",
  targetCharset: "gbk",
  strict: false,
  hex: INITIAL_HEX,
  result: EMPTY_RESULT,
  updateSource: (patch) =>
    set((state) => ({ source: { ...state.source, ...patch } })),
  setTargetForm: (form) => set({ targetForm: form }),
  setTargetCharset: (charset) => set({ targetCharset: charset }),
  setStrict: (strict) => set({ strict }),
  setHex: (patch) => set((state) => ({ hex: { ...state.hex, ...patch } })),
  swap: () =>
    set((state) => ({
      source: {
        form: state.targetForm,
        charset: state.targetCharset,
        text: state.result.output,
      },
      targetForm: state.source.form,
      targetCharset: state.source.charset,
    })),
  setResult: (result) => set({ result }),
  serialize: () => {
    const state = get();
    return {
      source: state.source,
      targetForm: state.targetForm,
      targetCharset: state.targetCharset,
      strict: state.strict,
      hex: state.hex,
    };
  },
  hydrate: (raw) => {
    if (typeof raw !== "object" || raw === null) {
      return;
    }
    const persisted = raw as Partial<EncodingPersisted> & {
      readonly hex?: Partial<HexOptions> & { readonly separator?: string };
    };
    set((state) => ({
      source: { ...state.source, ...persisted.source },
      targetForm: persisted.targetForm ?? state.targetForm,
      targetCharset: persisted.targetCharset ?? state.targetCharset,
      strict: persisted.strict ?? state.strict,
      hex: persisted.hex ? mergeHex(state.hex, persisted.hex) : state.hex,
    }));
  },
}));
