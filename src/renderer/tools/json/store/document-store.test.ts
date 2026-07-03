import { beforeEach, describe, expect, it } from "vitest";

import { useDocumentStore } from "./document-store";

beforeEach(() => {
  useDocumentStore.getState().reset();
});

describe("document-store", () => {
  it("初始有一个激活的空文档", () => {
    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(1);
    expect(state.activeId).toBe(state.documents[0].id);
    expect(state.documents[0].text).toBe("");
  });

  it("newDocument 追加并激活新文档", () => {
    useDocumentStore.getState().newDocument();
    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(2);
    expect(state.activeId).toBe(state.documents[1].id);
  });

  it("setText 触发解析", () => {
    const { activeId, setText } = useDocumentStore.getState();
    setText(activeId, '{"n":1}');
    const doc = useDocumentStore.getState().documents[0];
    expect(doc.text).toBe('{"n":1}');
    expect(doc.parseResult.root?.type).toBe("object");
  });

  it("selectNode 设置与清空选中", () => {
    const { activeId, setText, selectNode } = useDocumentStore.getState();
    setText(activeId, '{"n":1}');
    const root = useDocumentStore.getState().documents[0].parseResult.root!;
    selectNode(activeId, root.children[0]);
    expect(useDocumentStore.getState().documents[0].selectedKey).toBe('["n"]');
    selectNode(activeId, undefined);
    expect(
      useDocumentStore.getState().documents[0].selectedKey,
    ).toBeUndefined();
  });

  it("expandAll/collapseAll 切换展开集合", () => {
    const { activeId, setText, expandAll, collapseAll } =
      useDocumentStore.getState();
    setText(activeId, '{"a":{"b":1}}');
    expandAll(activeId);
    expect(useDocumentStore.getState().documents[0].expanded.size).toBe(2);
    collapseAll(activeId);
    expect(useDocumentStore.getState().documents[0].expanded.size).toBe(0);
  });

  it("setViewMode 改视图", () => {
    const { activeId, setViewMode } = useDocumentStore.getState();
    setViewMode(activeId, "raw");
    expect(useDocumentStore.getState().documents[0].viewMode).toBe("raw");
  });

  it("closeDocument 删除并保证至少一个文档", () => {
    const { activeId, closeDocument } = useDocumentStore.getState();
    closeDocument(activeId);
    expect(useDocumentStore.getState().documents).toHaveLength(1);
  });
});

describe("document-store 搜索与路径", () => {
  it("setPathFormat 改全局路径格式", () => {
    useDocumentStore.getState().setPathFormat("pointer");
    expect(useDocumentStore.getState().pathFormat).toBe("pointer");
  });

  it("setSearch 计算命中 nodeKey", () => {
    const { activeId, setText, setSearch } = useDocumentStore.getState();
    setText(activeId, '{"name":"Alice","city":"NYC"}');
    setSearch(activeId, "alice", false);
    const search = useDocumentStore.getState().documents[0].search;
    expect(search.matchKeys).toHaveLength(1);
    expect(search.activeIndex).toBe(0);
  });

  it("gotoMatch 循环并选中, 展开祖先", () => {
    const { activeId, setText, setSearch, gotoMatch } =
      useDocumentStore.getState();
    setText(activeId, '{"a":{"x":"hit"},"b":{"y":"hit"}}');
    setSearch(activeId, "hit", false);
    gotoMatch(activeId, 1);
    const doc = useDocumentStore.getState().documents[0];
    expect(doc.search.activeIndex).toBe(1);
    expect(doc.selectedKey).toBe(doc.search.matchKeys[1]);
    expect(doc.expanded.has(JSON.stringify(["b"]))).toBe(true);
  });

  it("toggleFilter 翻转过滤", () => {
    const { activeId, toggleFilter } = useDocumentStore.getState();
    toggleFilter(activeId);
    expect(useDocumentStore.getState().documents[0].search.filtering).toBe(
      true,
    );
  });

  it("clearSearch 清空", () => {
    const { activeId, setText, setSearch, clearSearch } =
      useDocumentStore.getState();
    setText(activeId, '{"k":"v"}');
    setSearch(activeId, "v", false);
    clearSearch(activeId);
    expect(useDocumentStore.getState().documents[0].search.query).toBe("");
    expect(
      useDocumentStore.getState().documents[0].search.matchKeys,
    ).toHaveLength(0);
  });

  it("revealKey 展开祖先并选中", () => {
    const { activeId, setText, revealKey } = useDocumentStore.getState();
    setText(activeId, '{"a":{"b":1}}');
    revealKey(activeId, JSON.stringify(["a", "b"]));
    const doc = useDocumentStore.getState().documents[0];
    expect(doc.selectedKey).toBe(JSON.stringify(["a", "b"]));
    expect(doc.expanded.has(JSON.stringify(["a"]))).toBe(true);
    expect(doc.expanded.has(JSON.stringify([]))).toBe(true);
  });

  it("openDocument 新建带内容文档并激活", () => {
    const { openDocument } = useDocumentStore.getState();
    const before = useDocumentStore.getState().documents.length;
    openDocument('{"opened":true}');
    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(before + 1);
    expect(state.documents[state.documents.length - 1].text).toBe(
      '{"opened":true}',
    );
    expect(state.activeId).toBe(state.documents[state.documents.length - 1].id);
  });
});

describe("document-store 文本变换", () => {
  it("formatDocument 美化并保留大数", () => {
    const { activeId, setText, formatDocument } = useDocumentStore.getState();
    setText(activeId, '{"id":9123372036854000123,"a":1}');
    formatDocument(activeId);
    const text = useDocumentStore.getState().documents[0].text;
    expect(text).toContain("9123372036854000123");
    expect(text).toContain("\n");
  });

  it("minifyDocument 压缩成单行", () => {
    const { activeId, setText, minifyDocument } = useDocumentStore.getState();
    setText(activeId, '{\n  "a": 1\n}');
    minifyDocument(activeId);
    expect(useDocumentStore.getState().documents[0].text).toBe('{"a":1}');
  });

  it("sortKeysDocument 按键排序", () => {
    const { activeId, setText, sortKeysDocument } = useDocumentStore.getState();
    setText(activeId, '{"b":1,"a":2}');
    sortKeysDocument(activeId);
    expect(useDocumentStore.getState().documents[0].text).toBe(
      '{\n  "a": 2,\n  "b": 1\n}',
    );
  });

  it("escapeDocument / unescapeDocument 往返", () => {
    const { activeId, setText, escapeDocument, unescapeDocument } =
      useDocumentStore.getState();
    setText(activeId, '{"a":1}');
    escapeDocument(activeId);
    expect(useDocumentStore.getState().documents[0].text).toBe('"{\\"a\\":1}"');
    unescapeDocument(activeId);
    expect(useDocumentStore.getState().documents[0].text).toBe('{"a":1}');
  });

  it("非法 JSON 时 formatDocument 不改文本", () => {
    const { activeId, setText, formatDocument } = useDocumentStore.getState();
    setText(activeId, "}");
    formatDocument(activeId);
    expect(useDocumentStore.getState().documents[0].text).toBe("}");
  });
});

describe("document-store 会话持久化", () => {
  it("serializeSession 反映文档/激活/路径格式", () => {
    const store = useDocumentStore.getState();
    store.setText(store.activeId, '{"a":1}');
    store.setViewMode(store.activeId, "raw");
    store.setPathFormat("pointer");
    const session = useDocumentStore.getState().serializeSession();
    expect(session.documents).toHaveLength(1);
    expect(session.documents[0].text).toBe('{"a":1}');
    expect(session.documents[0].viewMode).toBe("raw");
    expect(session.activeIndex).toBe(0);
    expect(session.pathFormat).toBe("pointer");
  });

  it("hydrateSession 还原文档与激活项", () => {
    useDocumentStore.getState().hydrateSession({
      documents: [
        {
          title: "文档 A",
          text: '{"x":1}',
          viewMode: "tree",
          selectedKey: undefined,
          expanded: [],
        },
        {
          title: "文档 B",
          text: '{"y":2}',
          viewMode: "raw",
          selectedKey: undefined,
          expanded: [],
        },
      ],
      activeIndex: 1,
      pathFormat: "jsonpath",
    });
    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(2);
    expect(state.documents[0].title).toBe("文档 A");
    expect(state.documents[0].parseResult.root?.type).toBe("object");
    expect(state.activeId).toBe(state.documents[1].id);
    expect(state.pathFormat).toBe("jsonpath");
  });

  it("hydrateSession 空文档列表回退到初始状态", () => {
    useDocumentStore.getState().hydrateSession({
      documents: [],
      activeIndex: 0,
      pathFormat: "js",
    });
    expect(useDocumentStore.getState().documents).toHaveLength(1);
  });
});

describe("document-store 对比", () => {
  it("toggleCompare 开启时默认选非激活文档为 B", () => {
    const store = useDocumentStore.getState();
    store.newDocument();
    store.toggleCompare();
    const state = useDocumentStore.getState();
    expect(state.compare).toBe(true);
    expect(state.compareBId).toBe(state.documents[0].id);
    expect(state.compareBId).not.toBe(state.activeId);
  });

  it("toggleCompare 再次关闭", () => {
    useDocumentStore.getState().toggleCompare();
    expect(useDocumentStore.getState().compare).toBe(true);
    useDocumentStore.getState().toggleCompare();
    expect(useDocumentStore.getState().compare).toBe(false);
  });

  it("setCompareMode 切换模式", () => {
    useDocumentStore.getState().setCompareMode("semantic");
    expect(useDocumentStore.getState().compareMode).toBe("semantic");
  });

  it("setCompareB 指定 B 文档", () => {
    const store = useDocumentStore.getState();
    store.newDocument();
    const firstId = useDocumentStore.getState().documents[0].id;
    store.setCompareB(firstId);
    expect(useDocumentStore.getState().compareBId).toBe(firstId);
  });
});

describe("document-store serializeDocument", () => {
  it("只含指定文档", () => {
    const store = useDocumentStore.getState();
    store.newDocument();
    const activeId = useDocumentStore.getState().activeId;
    store.setText(activeId, '{"z":9}');
    const session = useDocumentStore.getState().serializeDocument(activeId);
    expect(session.documents).toHaveLength(1);
    expect(session.documents[0].text).toBe('{"z":9}');
    expect(session.activeIndex).toBe(0);
  });
});

describe("document-store 标题序号回收", () => {
  it("关闭后新建填补最小空缺, 而非全局自增", () => {
    expect(useDocumentStore.getState().documents[0].title).toBe("文档 1");
    useDocumentStore.getState().newDocument();
    const second = useDocumentStore.getState().documents[1];
    expect(second.title).toBe("文档 2");
    useDocumentStore.getState().closeDocument(second.id);
    useDocumentStore.getState().newDocument();
    const docs = useDocumentStore.getState().documents;
    expect(docs).toHaveLength(2);
    expect(docs[1].title).toBe("文档 2");
  });

  it("填补中间空缺序号", () => {
    const store = useDocumentStore.getState();
    store.newDocument();
    store.newDocument();
    let docs = useDocumentStore.getState().documents;
    expect(docs.map((doc) => doc.title)).toEqual([
      "文档 1",
      "文档 2",
      "文档 3",
    ]);
    store.closeDocument(docs[1].id);
    useDocumentStore.getState().newDocument();
    docs = useDocumentStore.getState().documents;
    expect(docs.map((doc) => doc.title)).toEqual([
      "文档 1",
      "文档 3",
      "文档 2",
    ]);
  });
});

describe("document-store pathPrefix", () => {
  it("默认关闭, setPathPrefix 切换并随会话序列化/水合", () => {
    expect(useDocumentStore.getState().pathPrefix).toBe(false);
    useDocumentStore.getState().setPathPrefix(true);
    const session = useDocumentStore.getState().serializeSession();
    expect(session.pathPrefix).toBe(true);
    useDocumentStore.getState().reset();
    expect(useDocumentStore.getState().pathPrefix).toBe(false);
    useDocumentStore.getState().hydrateSession(session);
    expect(useDocumentStore.getState().pathPrefix).toBe(true);
  });
});

describe("document-store 行尾归一 (EOL)", () => {
  it("setText 把 CRLF 归一为 LF (与强制 LF 的 Monaco 模型一致)", () => {
    const { activeId, setText } = useDocumentStore.getState();
    setText(activeId, '{\r\n  "a": 1,\r\n  "b": true\r\n}');
    const doc = useDocumentStore.getState().documents[0];
    expect(doc.text.includes("\r")).toBe(false);
    expect(doc.text).toBe('{\n  "a": 1,\n  "b": true\n}');
    // 节点偏移基于归一后的 LF 文本: "b" 成员的值切片应恰为 "true"
    const bNode = doc.parseResult.root?.children.find(
      (child) => child.key === "b",
    );
    expect(bNode).toBeDefined();
    if (bNode) {
      expect(doc.text.slice(bNode.offset, bNode.offset + bNode.length)).toBe(
        "true",
      );
    }
  });

  it("openDocument 也把 CRLF 归一为 LF", () => {
    useDocumentStore.getState().openDocument('{\r\n"x":0\r\n}');
    const docs = useDocumentStore.getState().documents;
    const opened = docs[docs.length - 1];
    expect(opened.text.includes("\r")).toBe(false);
  });
});
