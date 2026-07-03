import { create } from "zustand";

import type { SignDraft } from "../model/types";

/**
 * jwt 工具的持久化形状 (不含密钥与瞬时结果).
 */
export interface JwtPersisted {
  readonly tab: "decode" | "sign";
  readonly token: string;
  readonly draft: SignDraft;
}

/**
 * jwt 工具全局状态; 密钥仅存内存, 不持久化.
 */
interface JwtState extends JwtPersisted {
  readonly verifyKey: string;
  readonly signKey: string;
  readonly setTab: (tab: JwtPersisted["tab"]) => void;
  readonly setToken: (token: string) => void;
  readonly setVerifyKey: (key: string) => void;
  readonly setSignKey: (key: string) => void;
  readonly updateDraft: (patch: Partial<SignDraft>) => void;
  readonly serialize: () => JwtPersisted;
  readonly hydrate: (raw: unknown) => void;
}

/**
 * 签发草稿初始态.
 */
const INITIAL_DRAFT: SignDraft = {
  alg: "HS256",
  headerExtra: "",
  payload: '{\n  "sub": "1234567890"\n}',
};

/**
 * jwt 工具 store. 密钥 (verifyKey/signKey) 仅存内存, serialize 快照不含密钥字段.
 */
export const useJwtStore = create<JwtState>((set, get) => ({
  tab: "decode",
  token: "",
  draft: INITIAL_DRAFT,
  verifyKey: "",
  signKey: "",
  setTab: (tab) => set({ tab }),
  setToken: (token) => set({ token }),
  setVerifyKey: (verifyKey) => set({ verifyKey }),
  setSignKey: (signKey) => set({ signKey }),
  updateDraft: (patch) =>
    set((state) => ({ draft: { ...state.draft, ...patch } })),
  serialize: () => {
    const state = get();
    // 仅返回持久化字段, 有意排除 verifyKey/signKey.
    return { tab: state.tab, token: state.token, draft: state.draft };
  },
  hydrate: (raw) => {
    if (typeof raw !== "object" || raw === null) {
      return;
    }
    const persisted = raw as Partial<JwtPersisted>;
    set((state) => ({
      tab: persisted.tab ?? state.tab,
      token: persisted.token ?? state.token,
      draft: persisted.draft
        ? { ...state.draft, ...persisted.draft }
        : state.draft,
    }));
  },
}));
