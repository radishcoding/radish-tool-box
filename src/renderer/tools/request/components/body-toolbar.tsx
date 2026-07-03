import { type ReactElement, type ReactNode } from "react";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Search,
  WrapText,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 工具栏图标按钮: 统一尺寸, 悬停变底色 (不移位), toggle 激活态用主色.
 * @param label 无障碍标签与悬停提示.
 * @param active 是否为激活 (toggle on) 态.
 * @param onClick 点击回调.
 * @param children 图标.
 */
function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  readonly label: string;
  readonly active?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active &&
          "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

/**
 * 响应体工具栏: 搜索 / 换行 / 复制 / 保存文件.
 * @param searchOpen 搜索栏是否展开.
 * @param onToggleSearch 切换搜索栏.
 * @param wrap 是否自动换行.
 * @param onToggleWrap 切换换行.
 * @param copied 复制成功的短暂反馈态.
 * @param onCopy 复制响应体.
 * @param onSave 保存响应体为文件.
 */
export function BodyToolbar({
  searchOpen,
  onToggleSearch,
  wrap,
  onToggleWrap,
  copied,
  onCopy,
  onSave,
}: {
  readonly searchOpen: boolean;
  readonly onToggleSearch: () => void;
  readonly wrap: boolean;
  readonly onToggleWrap: () => void;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onSave: () => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton label="搜索" active={searchOpen} onClick={onToggleSearch}>
        <Search className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={wrap ? "取消自动换行" : "自动换行"}
        active={wrap}
        onClick={onToggleWrap}
      >
        <WrapText className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label={copied ? "已复制" : "复制"} onClick={onCopy}>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </ToolbarButton>
      <ToolbarButton label="保存文件" onClick={onSave}>
        <Download className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

/**
 * 响应体搜索栏: 输入框 + 匹配计数 (n/total) + 上/下导航 + 关闭.
 * @param term 搜索词.
 * @param onTermChange 输入变化.
 * @param count 匹配总数.
 * @param activeIndex 当前匹配序号 (0 基, -1 表示无).
 * @param onNext 下一个匹配.
 * @param onPrev 上一个匹配.
 * @param onClose 关闭搜索栏.
 */
export function SearchBar({
  term,
  onTermChange,
  count,
  activeIndex,
  onNext,
  onPrev,
  onClose,
}: {
  readonly term: string;
  readonly onTermChange: (value: string) => void;
  readonly count: number;
  readonly activeIndex: number;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className="mb-2 flex shrink-0 items-center gap-1 rounded border bg-muted/40 px-2 py-1">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        autoFocus
        value={term}
        onChange={(e) => onTermChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
              onPrev();
            } else {
              onNext();
            }
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
        placeholder="在响应中搜索"
        className="h-6 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {term === ""
          ? ""
          : count === 0
            ? "无匹配"
            : `${activeIndex + 1}/${count}`}
      </span>
      <ToolbarButton label="上一个" onClick={onPrev}>
        <ChevronUp className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="下一个" onClick={onNext}>
        <ChevronDown className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="关闭搜索" onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}
