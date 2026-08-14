import { create } from "zustand";

import type {
  PersistedDocument,
  PersistedSession,
} from "../../../../ipc-channels";
import { escapeToJsonString, unescapeJsonString } from "../model/escape";
import { minifyValue, sortValueKeys, stringifyValue } from "../model/format";
import { nodeKey, type JsonNode, type PathSegment } from "../model/json-node";
import type { PathFormat } from "../model/json-path";
import { parseDocument, type ParseResult } from "../model/parse-document";
import { searchNodes } from "../model/search";

/**
 * 视图模式.
 */
export type ViewMode = "tree" | "raw";

/**
 * 对比模式的子模式.
 */
export type CompareMode = "raw" | "tree" | "semantic";

/**
 * 树内搜索状态.
 */
export interface SearchState {
  readonly query: string;
  readonly useRegex: boolean;
  /**
   * 命中节点的 nodeKey, 有序.
   */
  readonly matchKeys: readonly string[];
  /**
   * 当前命中索引; 无命中为 -1.
   */
  readonly activeIndex: number;
  readonly filtering: boolean;
}

/**
 * 搜索状态初值.
 */
const EMPTY_SEARCH: SearchState = {
  query: "",
  useRegex: false,
  matchKeys: [],
  activeIndex: -1,
  filtering: false,
};

/**
 * 单个文档的完整状态.
 */
export interface JsonDocument {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly parseResult: ParseResult;
  /**
   * 选中节点的 nodeKey; 无选中为 undefined.
   */
  readonly selectedKey: string | undefined;
  readonly viewMode: ViewMode;
  /**
   * 展开节点的 nodeKey 集合.
   */
  readonly expanded: ReadonlySet<string>;
  readonly search: SearchState;
}

/**
 * 文档 store 的状态与动作.
 */
export interface DocumentStore {
  readonly documents: readonly JsonDocument[];
  readonly activeId: string;
  readonly pathFormat: PathFormat;
  readonly pathPrefix: boolean;
  readonly compare: boolean;
  readonly compareMode: CompareMode;
  readonly compareBId: string | undefined;
  newDocument: () => void;
  closeDocument: (id: string) => void;
  setActiveDocument: (id: string) => void;
  setText: (id: string, text: string) => void;
  setViewMode: (id: string, mode: ViewMode) => void;
  selectNode: (id: string, node: JsonNode | undefined) => void;
  toggleExpand: (id: string, node: JsonNode) => void;
  expandAll: (id: string) => void;
  collapseAll: (id: string) => void;
  formatDocument: (id: string) => void;
  minifyDocument: (id: string) => void;
  sortKeysDocument: (id: string) => void;
  escapeDocument: (id: string) => void;
  unescapeDocument: (id: string) => void;
  /** 清空文档的全部内容, 并一并重置其选中, 展开与搜索状态. */
  clearDocument: (id: string) => void;
  setPathFormat: (format: PathFormat) => void;
  setPathPrefix: (value: boolean) => void;
  toggleCompare: () => void;
  setCompareMode: (mode: CompareMode) => void;
  setCompareB: (id: string) => void;
  setSearch: (id: string, query: string, useRegex: boolean) => void;
  gotoMatch: (id: string, delta: number) => void;
  toggleFilter: (id: string) => void;
  clearSearch: (id: string) => void;
  revealKey: (id: string, key: string) => void;
  openDocument: (text: string, title?: string) => void;
  serializeSession: () => PersistedSession;
  serializeDocument: (id: string) => PersistedSession;
  hydrateSession: (session: PersistedSession) => void;
  reset: () => void;
}

/**
 * 文档 id 的自增计数; 只增不减, 保证 id 全局唯一 (即便标题序号被回收复用).
 */
let documentIdCounter = 0;

/**
 * 默认标题前缀; 自动标题形如 "文档 N".
 */
const DEFAULT_TITLE_PREFIX = "文档 ";

/**
 * 计算未被占用的最小正整数序号, 生成默认标题 "文档 N".
 * 关闭文档会释放其序号, 新建时填补最小空缺, 而非全局自增.
 * @param documents 现有文档列表.
 * @returns 形如 "文档 N" 的默认标题.
 */
function nextDefaultTitle(documents: readonly JsonDocument[]): string {
  const used = new Set<number>();
  for (const doc of documents) {
    if (doc.title.startsWith(DEFAULT_TITLE_PREFIX)) {
      const value = Number(doc.title.slice(DEFAULT_TITLE_PREFIX.length));
      if (Number.isInteger(value) && value > 0) {
        used.add(value);
      }
    }
  }
  let next = 1;
  while (used.has(next)) {
    next += 1;
  }
  return `${DEFAULT_TITLE_PREFIX}${next}`;
}

/**
 * 归一行尾为 LF. Monaco 模型已强制 LF; 存储文本同步归一, 使解析得到的节点偏移与编辑器
 * getOffsetAt 一致 (否则 CRLF 文件或旧会话会让原文视图光标定位偏到后面的节点).
 */
function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/**
 * 新建一个文档对象 (立即解析其文本); id 全局唯一, 标题由调用方决定.
 */
function createDocument(text: string, title: string): JsonDocument {
  const lfText = normalizeEol(text);
  documentIdCounter += 1;
  return {
    id: `doc-${documentIdCounter}`,
    title,
    text: lfText,
    parseResult: parseDocument(lfText),
    selectedKey: undefined,
    viewMode: "tree",
    expanded: new Set<string>(),
    search: EMPTY_SEARCH,
  };
}

/**
 * 初始状态: 单个空文档.
 */
function createInitialState(): Pick<
  DocumentStore,
  | "documents"
  | "activeId"
  | "pathFormat"
  | "pathPrefix"
  | "compare"
  | "compareMode"
  | "compareBId"
> {
  const first = createDocument("", nextDefaultTitle([]));
  return {
    documents: [first],
    activeId: first.id,
    pathFormat: "js",
    pathPrefix: false,
    compare: false,
    compareMode: "raw",
    compareBId: undefined,
  };
}

/**
 * 按 id 不可变地更新某个文档.
 */
function mapDocument(
  state: DocumentStore,
  id: string,
  updater: (doc: JsonDocument) => JsonDocument,
): Pick<DocumentStore, "documents"> {
  return {
    documents: state.documents.map((doc) =>
      doc.id === id ? updater(doc) : doc,
    ),
  };
}

/**
 * 收集 root 下所有可展开 (含子节点) 节点的 nodeKey.
 */
function collectExpandableKeys(root: JsonNode | undefined): Set<string> {
  const keys = new Set<string>();
  if (!root) {
    return keys;
  }
  const walk = (node: JsonNode): void => {
    if (node.children.length > 0) {
      keys.add(nodeKey(node));
      node.children.forEach(walk);
    }
  };
  walk(root);
  return keys;
}

/**
 * 据 root 与查询重算命中 nodeKey 列表.
 */
function computeMatchKeys(
  root: JsonNode | undefined,
  query: string,
  useRegex: boolean,
): string[] {
  if (!root || query === "") {
    return [];
  }
  return searchNodes(root, query, { useRegex }).map(nodeKey);
}

/**
 * 把某 nodeKey 的全部祖先 key 加入展开集合 (返回新集合).
 */
function withAncestorsExpanded(
  expanded: ReadonlySet<string>,
  key: string,
): Set<string> {
  const next = new Set(expanded);
  const path = JSON.parse(key) as PathSegment[];
  for (let index = 0; index < path.length; index += 1) {
    next.add(JSON.stringify(path.slice(0, index)));
  }
  return next;
}

/**
 * 用新文本更新文档: 重新解析并按当前查询重算命中.
 */
function applyText(doc: JsonDocument, text: string): JsonDocument {
  const lfText = normalizeEol(text);
  const parseResult = parseDocument(lfText);
  const matchKeys = computeMatchKeys(
    parseResult.root,
    doc.search.query,
    doc.search.useRegex,
  );
  return {
    ...doc,
    text: lfText,
    parseResult,
    search: {
      ...doc.search,
      matchKeys,
      activeIndex: matchKeys.length > 0 ? 0 : -1,
    },
  };
}

/**
 * 把文档序列化为持久化形态.
 */
function toPersistedDocument(doc: JsonDocument): PersistedDocument {
  return {
    title: doc.title,
    text: doc.text,
    viewMode: doc.viewMode,
    selectedKey: doc.selectedKey,
    expanded: [...doc.expanded],
  };
}

/**
 * 全局文档 store (每个渲染进程/窗口各持有一份实例).
 */
export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  ...createInitialState(),

  newDocument: () =>
    set((state) => {
      const doc = createDocument("", nextDefaultTitle(state.documents));
      return { documents: [...state.documents, doc], activeId: doc.id };
    }),

  closeDocument: (id) =>
    set((state) => {
      const remaining = state.documents.filter((doc) => doc.id !== id);
      if (remaining.length === 0) {
        const doc = createDocument("", nextDefaultTitle(remaining));
        return { documents: [doc], activeId: doc.id };
      }
      const activeId =
        state.activeId === id
          ? remaining[remaining.length - 1].id
          : state.activeId;
      return { documents: remaining, activeId };
    }),

  setActiveDocument: (id) => set({ activeId: id }),

  setText: (id, text) =>
    set((state) => mapDocument(state, id, (doc) => applyText(doc, text))),

  setViewMode: (id, mode) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({ ...doc, viewMode: mode })),
    ),

  selectNode: (id, node) => {
    const key = node ? nodeKey(node) : undefined;
    const target = get().documents.find((doc) => doc.id === id);
    if (!target || target.selectedKey === key) {
      // 选中未变 (光标在同一节点内移动) 则不触发更新, 避免无谓重渲染
      return;
    }
    set((state) =>
      mapDocument(state, id, (doc) => ({ ...doc, selectedKey: key })),
    );
  },

  toggleExpand: (id, node) =>
    set((state) =>
      mapDocument(state, id, (doc) => {
        const key = nodeKey(node);
        const expanded = new Set(doc.expanded);
        if (expanded.has(key)) {
          expanded.delete(key);
        } else {
          expanded.add(key);
        }
        return { ...doc, expanded };
      }),
    ),

  expandAll: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({
        ...doc,
        expanded: collectExpandableKeys(doc.parseResult.root),
      })),
    ),

  collapseAll: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({
        ...doc,
        expanded: new Set<string>(),
      })),
    ),

  formatDocument: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) =>
        doc.parseResult.value === undefined
          ? doc
          : applyText(doc, stringifyValue(doc.parseResult.value, 2)),
      ),
    ),

  minifyDocument: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) =>
        doc.parseResult.value === undefined
          ? doc
          : applyText(doc, minifyValue(doc.parseResult.value)),
      ),
    ),

  sortKeysDocument: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) =>
        doc.parseResult.value === undefined
          ? doc
          : applyText(
              doc,
              stringifyValue(sortValueKeys(doc.parseResult.value), 2),
            ),
      ),
    ),

  escapeDocument: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) =>
        applyText(doc, escapeToJsonString(doc.text)),
      ),
    ),

  unescapeDocument: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) =>
        applyText(doc, unescapeJsonString(doc.text)),
      ),
    ),

  clearDocument: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({
        ...applyText(doc, ""),
        selectedKey: undefined,
        expanded: new Set<string>(),
        search: EMPTY_SEARCH,
      })),
    ),

  setPathFormat: (format) => set({ pathFormat: format }),

  setPathPrefix: (value) => set({ pathPrefix: value }),

  toggleCompare: () =>
    set((state) => {
      if (state.compare) {
        return { compare: false };
      }
      const fallbackB =
        state.compareBId &&
        state.documents.some((doc) => doc.id === state.compareBId)
          ? state.compareBId
          : state.documents.find((doc) => doc.id !== state.activeId)?.id;
      return { compare: true, compareBId: fallbackB };
    }),

  setCompareMode: (mode) => set({ compareMode: mode }),

  setCompareB: (id) => set({ compareBId: id }),

  setSearch: (id, query, useRegex) =>
    set((state) =>
      mapDocument(state, id, (doc) => {
        const matchKeys = computeMatchKeys(
          doc.parseResult.root,
          query,
          useRegex,
        );
        return {
          ...doc,
          search: {
            ...doc.search,
            query,
            useRegex,
            matchKeys,
            activeIndex: matchKeys.length > 0 ? 0 : -1,
          },
        };
      }),
    ),

  gotoMatch: (id, delta) =>
    set((state) =>
      mapDocument(state, id, (doc) => {
        const { matchKeys, activeIndex } = doc.search;
        if (matchKeys.length === 0) {
          return doc;
        }
        const count = matchKeys.length;
        const nextIndex = (activeIndex + delta + count) % count;
        const key = matchKeys[nextIndex];
        return {
          ...doc,
          selectedKey: key,
          expanded: withAncestorsExpanded(doc.expanded, key),
          search: { ...doc.search, activeIndex: nextIndex },
        };
      }),
    ),

  toggleFilter: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({
        ...doc,
        search: { ...doc.search, filtering: !doc.search.filtering },
      })),
    ),

  clearSearch: (id) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({ ...doc, search: EMPTY_SEARCH })),
    ),

  revealKey: (id, key) =>
    set((state) =>
      mapDocument(state, id, (doc) => ({
        ...doc,
        selectedKey: key,
        expanded: withAncestorsExpanded(doc.expanded, key),
      })),
    ),

  openDocument: (text, title) =>
    set((state) => {
      const resolvedTitle = title ? title : nextDefaultTitle(state.documents);
      const doc = createDocument(text, resolvedTitle);
      // 新载入的数据默认全部展开
      const expanded = collectExpandableKeys(doc.parseResult.root);
      return {
        documents: [...state.documents, { ...doc, expanded }],
        activeId: doc.id,
      };
    }),

  serializeSession: () => {
    const state = get();
    const activeIndex = state.documents.findIndex(
      (doc) => doc.id === state.activeId,
    );
    const documents: PersistedDocument[] =
      state.documents.map(toPersistedDocument);
    return {
      documents,
      activeIndex: activeIndex < 0 ? 0 : activeIndex,
      pathFormat: state.pathFormat,
      pathPrefix: state.pathPrefix,
    };
  },

  serializeDocument: (id) => {
    const doc = get().documents.find((item) => item.id === id);
    return {
      documents: doc ? [toPersistedDocument(doc)] : [],
      activeIndex: 0,
      pathFormat: get().pathFormat,
      pathPrefix: get().pathPrefix,
    };
  },

  hydrateSession: (session) =>
    set(() => {
      if (session.documents.length === 0) {
        return createInitialState();
      }
      const documents: JsonDocument[] = session.documents.map((persisted) => {
        const base = createDocument(persisted.text, persisted.title);
        return {
          ...base,
          viewMode: persisted.viewMode,
          selectedKey: persisted.selectedKey,
          expanded: new Set(persisted.expanded),
        };
      });
      const activeIndex = Math.min(
        Math.max(session.activeIndex, 0),
        documents.length - 1,
      );
      return {
        documents,
        activeId: documents[activeIndex].id,
        pathFormat: session.pathFormat,
        pathPrefix: session.pathPrefix ?? false,
      };
    }),

  reset: () => set(createInitialState()),
}));
