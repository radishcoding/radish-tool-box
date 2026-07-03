import { create } from "zustand";

import { DEFAULT_CHARSET } from "@/lib/charset/charsets";
import type { HexOptions } from "@/lib/charset/hex";
import { EMPTY_RESULT, type ResultView } from "@/lib/outcome";

import type { Direction } from "../model/types";

/**
 * codec 工具的持久化形状 (不含结果与动作).
 */
export interface CodecPersisted {
  readonly codecId: string;
  readonly direction: Direction;
  readonly charset: string;
  readonly hex: HexOptions;
  readonly input: string;
  /** 各 codec 的专属选项值, 按 codec id 命名空间. */
  readonly options: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * codec 工具全局状态.
 */
interface CodecState extends CodecPersisted {
  readonly result: ResultView;
  readonly setCodecId: (id: string) => void;
  readonly setDirection: (direction: Direction) => void;
  readonly setInput: (input: string) => void;
  readonly setCharset: (charset: string) => void;
  readonly setHex: (patch: Partial<HexOptions>) => void;
  readonly setOption: (
    codecId: string,
    optionId: string,
    value: string,
  ) => void;
  readonly setResult: (result: ResultView) => void;
  readonly serialize: () => CodecPersisted;
  readonly hydrate: (raw: unknown) => void;
}

/**
 * 初始 Hex 选项.
 */
const INITIAL_HEX: HexOptions = { upperCase: false, format: "none" };

/**
 * codec 工具 store.
 */
export const useCodecStore = create<CodecState>((set, get) => ({
  codecId: "base64",
  direction: "encode",
  charset: DEFAULT_CHARSET,
  hex: INITIAL_HEX,
  input: "",
  options: {},
  result: EMPTY_RESULT,
  setCodecId: (id) => set({ codecId: id }),
  setDirection: (direction) => set({ direction }),
  setInput: (input) => set({ input }),
  setCharset: (charset) => set({ charset }),
  setHex: (patch) => set((state) => ({ hex: { ...state.hex, ...patch } })),
  setOption: (codecId, optionId, value) =>
    set((state) => ({
      options: {
        ...state.options,
        [codecId]: { ...state.options[codecId], [optionId]: value },
      },
    })),
  setResult: (result) => set({ result }),
  serialize: () => {
    const state = get();
    return {
      codecId: state.codecId,
      direction: state.direction,
      charset: state.charset,
      hex: state.hex,
      input: state.input,
      options: state.options,
    };
  },
  hydrate: (raw) => {
    if (typeof raw !== "object" || raw === null) {
      return;
    }
    const persisted = raw as Partial<CodecPersisted>;
    set((state) => ({
      codecId: persisted.codecId ?? state.codecId,
      direction: persisted.direction ?? state.direction,
      charset: persisted.charset ?? state.charset,
      hex: persisted.hex ? { ...state.hex, ...persisted.hex } : state.hex,
      input: persisted.input ?? state.input,
      options:
        typeof persisted.options === "object" && persisted.options !== null
          ? { ...state.options, ...persisted.options }
          : state.options,
    }));
  },
}));
