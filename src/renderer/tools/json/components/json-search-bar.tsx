import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  Filter,
  Regex,
  Search,
  X,
} from "lucide-react";
import type { ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { isValidRegex } from "../model/search";
import { useDocumentStore } from "../store/document-store";

/**
 * 树内搜索条: 关键词 + 清空 + 正则 + 命中计数与上/下跳转 + 过滤 + 全部展开/折叠.
 */
export function JsonSearchBar({
  documentId,
}: {
  readonly documentId?: string;
}): ReactElement | null {
  const doc = useDocumentStore((state) =>
    state.documents.find((item) => item.id === (documentId ?? state.activeId)),
  );
  const setSearch = useDocumentStore((state) => state.setSearch);
  const clearSearch = useDocumentStore((state) => state.clearSearch);
  const gotoMatch = useDocumentStore((state) => state.gotoMatch);
  const toggleFilter = useDocumentStore((state) => state.toggleFilter);
  const expandAll = useDocumentStore((state) => state.expandAll);
  const collapseAll = useDocumentStore((state) => state.collapseAll);

  if (!doc) {
    return null;
  }

  const { query, useRegex, matchKeys, activeIndex, filtering } = doc.search;
  const invalid = useRegex && query !== "" && !isValidRegex(query);
  const counter =
    matchKeys.length > 0 ? `${activeIndex + 1}/${matchKeys.length}` : "0/0";

  return (
    <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="relative flex-1">
        <Input
          value={query}
          onChange={(event) => setSearch(doc.id, event.target.value, useRegex)}
          placeholder="搜索键或值"
          className="h-7 bg-card pr-6 text-xs focus-visible:ring-1"
        />
        {query !== "" && (
          <button
            type="button"
            aria-label="清空搜索"
            className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => clearSearch(doc.id)}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
        {counter}
      </span>
      <IconAction
        icon={ChevronUp}
        label="上一个"
        onClick={() => gotoMatch(doc.id, -1)}
      />
      <IconAction
        icon={ChevronDown}
        label="下一个"
        onClick={() => gotoMatch(doc.id, 1)}
      />
      <IconAction
        icon={Regex}
        label="正则"
        active={useRegex}
        onClick={() => setSearch(doc.id, query, !useRegex)}
      />
      <IconAction
        icon={Filter}
        label="只显命中"
        active={filtering}
        onClick={() => toggleFilter(doc.id)}
      />
      <Separator orientation="vertical" className="mx-0.5 h-5!" />
      <IconAction
        icon={ChevronsUpDown}
        label="全部展开"
        onClick={() => expandAll(doc.id)}
      />
      <IconAction
        icon={ChevronsDownUp}
        label="全部折叠"
        onClick={() => collapseAll(doc.id)}
      />
      {invalid && (
        <span className="shrink-0 px-1 text-xs text-destructive">正则无效</span>
      )}
    </div>
  );
}
