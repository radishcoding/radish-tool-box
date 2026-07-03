import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * 容器内文本搜索的结果与导航接口.
 */
export interface ContentSearchResult {
  readonly count: number;
  readonly activeIndex: number;
  readonly goNext: () => void;
  readonly goPrev: () => void;
}

const HIGHLIGHT_NAME = "response-search";
const ACTIVE_NAME = "response-search-active";

/**
 * 取 CSS Custom Highlight 注册表 (环境不支持时返回 undefined).
 * @returns 高亮注册表或 undefined.
 */
function highlightRegistry(): HighlightRegistry | undefined {
  return typeof CSS !== "undefined" ? CSS.highlights : undefined;
}

/**
 * 用 CSS Custom Highlight API 在容器内高亮 term 的所有匹配, 并提供上/下导航.
 * 仅遍历可见文本 (跳过带 hidden 的非活动分页), 避免跨分页重复计数.
 * @param containerRef 搜索范围容器.
 * @param term 搜索词 (空串表示清除高亮).
 * @param contentKey 内容标识 (分页/响应变化时触发重算).
 * @returns 匹配数, 当前序号与导航函数.
 */
export function useContentSearch(
  containerRef: RefObject<HTMLElement | null>,
  term: string,
  contentKey: string,
): ContentSearchResult {
  const rangesRef = useRef<Range[]>([]);
  const [count, setCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const registry = highlightRegistry();
    const container = containerRef.current;
    if (registry === undefined || container === null || term === "") {
      registry?.delete(HIGHLIGHT_NAME);
      registry?.delete(ACTIVE_NAME);
      rangesRef.current = [];
      setCount(0);
      setActiveIndex(-1);
      return;
    }
    const needle = term.toLowerCase();
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if ((node.textContent ?? "") === "") {
          return NodeFilter.FILTER_REJECT;
        }
        // 跳过非活动分页 (Radix 给未选中的 TabsContent 加 hidden).
        if (node.parentElement?.closest("[hidden]") != null) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      const haystack = (node.textContent ?? "").toLowerCase();
      let from = haystack.indexOf(needle);
      while (from !== -1) {
        const range = document.createRange();
        range.setStart(node, from);
        range.setEnd(node, from + needle.length);
        ranges.push(range);
        from = haystack.indexOf(needle, from + needle.length);
      }
    }
    rangesRef.current = ranges;
    registry.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    setCount(ranges.length);
    setActiveIndex(ranges.length > 0 ? 0 : -1);
    return () => {
      registry.delete(HIGHLIGHT_NAME);
      registry.delete(ACTIVE_NAME);
    };
  }, [containerRef, term, contentKey]);

  // 高亮"当前"匹配并滚动到可见.
  useEffect(() => {
    const registry = highlightRegistry();
    if (registry === undefined) {
      return;
    }
    const ranges = rangesRef.current;
    if (activeIndex < 0 || activeIndex >= ranges.length) {
      registry.delete(ACTIVE_NAME);
      return;
    }
    const active = ranges[activeIndex];
    registry.set(ACTIVE_NAME, new Highlight(active));
    active.startContainer.parentElement?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [activeIndex]);

  const goNext = useCallback(() => {
    setActiveIndex((index) => (count === 0 ? -1 : (index + 1) % count));
  }, [count]);

  const goPrev = useCallback(() => {
    setActiveIndex((index) => (count === 0 ? -1 : (index - 1 + count) % count));
  }, [count]);

  return { count, activeIndex, goNext, goPrev };
}
