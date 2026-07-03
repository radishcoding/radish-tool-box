import { create } from "zustand";

import { EMPTY_RESULT, type ResultView } from "../model/result-view";
import { kdfDefaults, type KdfNumbers } from "../model/kdf";
import type { AsymOperation } from "../model/asym-types";
import type {
  SymmetricMode,
  SymmetricOperation,
  SymmetricPadding,
} from "../model/symmetric";
import type {
  AlgorithmCategory,
  ByteEncoding,
  EncodedBytes,
} from "../model/types";

/**
 * 算法调试工具的持久化形状 (纯可序列化数据, 不含动作).
 */
export interface CryptoPersisted {
  readonly activeCategory: AlgorithmCategory;
  readonly hash: HashPanelState;
  readonly hmac: HmacPanelState;
  readonly symmetric: SymmetricPanelState;
  readonly asym: AsymPanelState;
  readonly kdf: KdfPanelState;
}

/**
 * 哈希面板状态.
 */
export interface HashPanelState {
  readonly algorithmId: string;
  readonly input: EncodedBytes;
  readonly outputEncoding: ByteEncoding;
  readonly result: ResultView;
}

/**
 * HMAC 面板状态.
 */
export interface HmacPanelState {
  readonly hashId: string;
  readonly key: EncodedBytes;
  readonly input: EncodedBytes;
  readonly outputEncoding: ByteEncoding;
  readonly result: ResultView;
}

/**
 * 对称面板状态.
 */
export interface SymmetricPanelState {
  readonly algorithmId: string;
  readonly mode: SymmetricMode;
  readonly padding: SymmetricPadding;
  readonly operation: SymmetricOperation;
  readonly key: EncodedBytes;
  readonly iv: EncodedBytes;
  readonly aad: EncodedBytes;
  readonly input: EncodedBytes;
  readonly outputEncoding: ByteEncoding;
  readonly result: ResultView;
}

/**
 * 非对称面板状态.
 */
export interface AsymPanelState {
  readonly algorithmId: string;
  readonly operation: AsymOperation;
  readonly variant: string;
  readonly scheme: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly input: EncodedBytes;
  readonly signature: EncodedBytes;
  readonly outputEncoding: ByteEncoding;
  readonly result: ResultView;
  readonly verifyResult: "none" | "valid" | "invalid";
  readonly running: boolean;
}

/**
 * KDF 面板状态.
 */
export interface KdfPanelState extends KdfNumbers {
  readonly algorithmId: string;
  readonly hashId: string;
  readonly password: EncodedBytes;
  readonly salt: EncodedBytes;
  readonly info: EncodedBytes;
  readonly outputEncoding: ByteEncoding;
  readonly result: ResultView;
  readonly running: boolean;
}

/**
 * 算法调试工具的全局状态.
 */
interface CryptoState {
  readonly activeCategory: AlgorithmCategory;
  readonly hash: HashPanelState;
  readonly hmac: HmacPanelState;
  readonly symmetric: SymmetricPanelState;
  readonly kdf: KdfPanelState;
  readonly asym: AsymPanelState;
  readonly setActiveCategory: (category: AlgorithmCategory) => void;
  readonly updateHash: (patch: Partial<HashPanelState>) => void;
  readonly updateHmac: (patch: Partial<HmacPanelState>) => void;
  readonly updateSymmetric: (patch: Partial<SymmetricPanelState>) => void;
  readonly updateKdf: (patch: Partial<KdfPanelState>) => void;
  readonly updateAsym: (patch: Partial<AsymPanelState>) => void;
  /** 序列化当前状态为可持久化形状; running 不持久化为 true. */
  readonly serialize: () => CryptoPersisted;
  /** 将持久化数据合并进 store; 非对象输入安全忽略. */
  readonly hydrate: (raw: unknown) => void;
}

/**
 * 哈希面板初始态.
 */
const INITIAL_HASH: HashPanelState = {
  algorithmId: "sha256",
  input: { text: "", encoding: "utf8" },
  outputEncoding: "hex",
  result: EMPTY_RESULT,
};

/**
 * HMAC 面板初始态.
 */
const INITIAL_HMAC: HmacPanelState = {
  hashId: "sha256",
  key: { text: "", encoding: "utf8" },
  input: { text: "", encoding: "utf8" },
  outputEncoding: "hex",
  result: EMPTY_RESULT,
};

/**
 * KDF 面板初始态.
 */
const INITIAL_KDF: KdfPanelState = {
  algorithmId: "pbkdf2",
  hashId: "sha256",
  password: { text: "", encoding: "utf8" },
  salt: { text: "", encoding: "utf8" },
  info: { text: "", encoding: "utf8" },
  outputEncoding: "hex",
  result: EMPTY_RESULT,
  running: false,
  ...kdfDefaults("pbkdf2"),
};

/**
 * 非对称面板初始态.
 */
const INITIAL_ASYM: AsymPanelState = {
  algorithmId: "rsa",
  operation: "encrypt",
  variant: "2048",
  scheme: "oaep",
  publicKey: "",
  privateKey: "",
  input: { text: "", encoding: "utf8" },
  signature: { text: "", encoding: "hex" },
  outputEncoding: "base64",
  result: EMPTY_RESULT,
  verifyResult: "none",
  running: false,
};

/**
 * 对称面板初始态.
 */
const INITIAL_SYMMETRIC: SymmetricPanelState = {
  algorithmId: "aes",
  mode: "cbc",
  padding: "pkcs7",
  operation: "encrypt",
  key: { text: "", encoding: "hex" },
  iv: { text: "", encoding: "hex" },
  aad: { text: "", encoding: "hex" },
  input: { text: "", encoding: "utf8" },
  outputEncoding: "base64",
  result: EMPTY_RESULT,
};

/**
 * 算法调试工具 store.
 */
export const useCryptoStore = create<CryptoState>((set, get) => ({
  activeCategory: "hash",
  hash: INITIAL_HASH,
  hmac: INITIAL_HMAC,
  symmetric: INITIAL_SYMMETRIC,
  kdf: INITIAL_KDF,
  asym: INITIAL_ASYM,
  setActiveCategory: (category) => set({ activeCategory: category }),
  updateHash: (patch) =>
    set((state) => ({ hash: { ...state.hash, ...patch } })),
  updateHmac: (patch) =>
    set((state) => ({ hmac: { ...state.hmac, ...patch } })),
  updateSymmetric: (patch) =>
    set((state) => ({ symmetric: { ...state.symmetric, ...patch } })),
  updateKdf: (patch) => set((state) => ({ kdf: { ...state.kdf, ...patch } })),
  updateAsym: (patch) =>
    set((state) => ({ asym: { ...state.asym, ...patch } })),
  serialize: () => {
    const state = get();
    return {
      activeCategory: state.activeCategory,
      hash: state.hash,
      hmac: state.hmac,
      symmetric: state.symmetric,
      // running 不持久化为运行中, 避免重开后按钮卡死
      asym: { ...state.asym, running: false },
      kdf: { ...state.kdf, running: false },
    };
  },
  hydrate: (raw) => {
    if (typeof raw !== "object" || raw === null) {
      return;
    }
    const persisted = raw as Partial<CryptoPersisted>;

    /**
     * 对 EncodedBytes 子字段做兜底合并: 以初始值为基底, 再叠加持久化字段.
     * 若持久化中该子字段缺失则直接用初始值.
     * @param initial 初始默认值.
     * @param saved 持久化中的值 (可能 undefined 或缺子字段).
     * @returns 合并后的安全值.
     */
    function mergeEncoded(
      initial: EncodedBytes,
      saved: EncodedBytes | undefined,
    ): EncodedBytes {
      if (saved === undefined || typeof saved !== "object" || saved === null) {
        return initial;
      }
      return { ...initial, ...saved };
    }

    set((state) => {
      const ph = persisted.hash;
      const mergedHash: HashPanelState = {
        ...INITIAL_HASH,
        ...ph,
        input: mergeEncoded(INITIAL_HASH.input, ph?.input),
      };

      const phm = persisted.hmac;
      const mergedHmac: HmacPanelState = {
        ...INITIAL_HMAC,
        ...phm,
        key: mergeEncoded(INITIAL_HMAC.key, phm?.key),
        input: mergeEncoded(INITIAL_HMAC.input, phm?.input),
      };

      const ps = persisted.symmetric;
      const mergedSymmetric: SymmetricPanelState = {
        ...INITIAL_SYMMETRIC,
        ...ps,
        key: mergeEncoded(INITIAL_SYMMETRIC.key, ps?.key),
        iv: mergeEncoded(INITIAL_SYMMETRIC.iv, ps?.iv),
        aad: mergeEncoded(INITIAL_SYMMETRIC.aad, ps?.aad),
        input: mergeEncoded(INITIAL_SYMMETRIC.input, ps?.input),
      };

      const pk = persisted.kdf;
      const mergedKdf: KdfPanelState = {
        ...INITIAL_KDF,
        ...pk,
        password: mergeEncoded(INITIAL_KDF.password, pk?.password),
        salt: mergeEncoded(INITIAL_KDF.salt, pk?.salt),
        info: mergeEncoded(INITIAL_KDF.info, pk?.info),
        running: false,
      };

      const pa = persisted.asym;
      const mergedAsym: AsymPanelState = {
        ...INITIAL_ASYM,
        ...pa,
        input: mergeEncoded(INITIAL_ASYM.input, pa?.input),
        signature: mergeEncoded(INITIAL_ASYM.signature, pa?.signature),
        running: false,
      };

      return {
        activeCategory: persisted.activeCategory ?? state.activeCategory,
        hash: mergedHash,
        hmac: mergedHmac,
        symmetric: mergedSymmetric,
        asym: mergedAsym,
        kdf: mergedKdf,
      };
    });
  },
}));
