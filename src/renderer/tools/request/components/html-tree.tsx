import { useMemo, useState, type ReactElement } from "react";

import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * HTML 空元素 (自闭合, 无子节点; 小写标签名).
 */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * 保留原文的元素 (脚本/样式/预格式化, 内部文本不再拆分渲染).
 */
const RAW_TEXT_ELEMENTS: ReadonlySet<string> = new Set([
  "script",
  "style",
  "pre",
  "textarea",
]);

/**
 * 取元素的有意义子节点 (跳过纯空白文本节点).
 * @param node 元素.
 * @returns 保留的子节点数组.
 */
function meaningfulChildren(node: Element): readonly ChildNode[] {
  return Array.from(node.childNodes).filter((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return (child.textContent ?? "").trim() !== "";
    }
    return (
      child.nodeType === Node.ELEMENT_NODE ||
      child.nodeType === Node.COMMENT_NODE
    );
  });
}

/**
 * 渲染一个元素的属性列表 (name="value").
 * @param element 元素.
 */
function Attributes({ element }: { readonly element: Element }): ReactElement {
  return (
    <>
      {element.getAttributeNames().map((name) => (
        <span key={name}>
          {" "}
          <span className="text-purple-600">{name}</span>
          <span className="text-muted-foreground">=</span>
          <span className="text-emerald-600">
            {JSON.stringify(element.getAttribute(name) ?? "")}
          </span>
        </span>
      ))}
    </>
  );
}

/**
 * 渲染开标签 (含标签名, 属性与收尾符号).
 * @param element 元素.
 * @param selfClose 是否自闭合收尾 (空元素).
 */
function OpenTag({
  element,
  selfClose,
}: {
  readonly element: Element;
  readonly selfClose: boolean;
}): ReactElement {
  return (
    <>
      <span className="text-muted-foreground">{"<"}</span>
      <span className="text-sky-600">{element.tagName.toLowerCase()}</span>
      <Attributes element={element} />
      <span className="text-muted-foreground">{selfClose ? " />" : ">"}</span>
    </>
  );
}

/**
 * 渲染闭标签 (</tag>).
 * @param tagName 小写标签名.
 */
function CloseTag({ tagName }: { readonly tagName: string }): ReactElement {
  return (
    <>
      <span className="text-muted-foreground">{"</"}</span>
      <span className="text-sky-600">{tagName}</span>
      <span className="text-muted-foreground">{">"}</span>
    </>
  );
}

/**
 * 递归渲染一个 DOM 节点 (元素可折叠, 文本/注释按类型着色).
 * @param node DOM 节点.
 */
function HtmlNode({ node }: { readonly node: ChildNode }): ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);

  // 注释节点.
  if (node.nodeType === Node.COMMENT_NODE) {
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span className="text-muted-foreground/70 italic break-all">
          {"<!--"}
          {node.textContent ?? ""}
          {"-->"}
        </span>
      </div>
    );
  }

  // 文本节点.
  if (node.nodeType === Node.TEXT_NODE) {
    const content = (node.textContent ?? "").trim();
    if (content === "") {
      return null;
    }
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span className="break-all">{content}</span>
      </div>
    );
  }

  // 非元素节点 (文档类型等) 忽略.
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  // 空元素: 单行自闭合.
  if (VOID_ELEMENTS.has(tagName)) {
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span className="break-all">
          <OpenTag element={element} selfClose />
        </span>
      </div>
    );
  }

  // 保留原文元素 (script/style/pre): 开标签 + 原始文本 + 闭标签, 不拆分.
  if (RAW_TEXT_ELEMENTS.has(tagName)) {
    const raw = element.textContent ?? "";
    return (
      <div>
        <div className="flex items-start">
          <span className="w-3.5 shrink-0" />
          <span className="break-all">
            <OpenTag element={element} selfClose={false} />
          </span>
        </div>
        {raw.trim() !== "" && (
          <pre className="ml-[7px] border-l border-border/60 pl-3 whitespace-pre-wrap text-muted-foreground">
            {raw}
          </pre>
        )}
        <div className="flex items-start">
          <span className="w-3.5 shrink-0" />
          <span className="break-all">
            <CloseTag tagName={tagName} />
          </span>
        </div>
      </div>
    );
  }

  const children = meaningfulChildren(element);

  // 无子节点: <tag></tag> 单行.
  if (children.length === 0) {
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span className="break-all">
          <OpenTag element={element} selfClose={false} />
          <CloseTag tagName={tagName} />
        </span>
      </div>
    );
  }

  // 仅单个文本子节点: <tag>text</tag> 单行内联.
  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span className="break-all">
          <OpenTag element={element} selfClose={false} />
          {(children[0].textContent ?? "").trim()}
          <CloseTag tagName={tagName} />
        </span>
      </div>
    );
  }

  // 含子节点: 可折叠块.
  return (
    <div>
      <div
        className="flex cursor-pointer items-start rounded hover:bg-muted/40"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="flex w-3.5 shrink-0 justify-center pt-[3px]">
          <ChevronRightIcon
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              !collapsed && "rotate-90",
            )}
          />
        </span>
        <span className="break-all">
          <OpenTag element={element} selfClose={false} />
          {collapsed && (
            <>
              <span className="text-muted-foreground">…</span>
              <CloseTag tagName={tagName} />
              <span className="ml-1.5 text-muted-foreground/70">
                {children.length} 项
              </span>
            </>
          )}
        </span>
      </div>
      {!collapsed && (
        <div className="ml-[7px] border-l border-border/60 pl-3">
          {children.map((child, index) => (
            <HtmlNode key={index} node={child} />
          ))}
        </div>
      )}
      {!collapsed && (
        <div className="flex items-start">
          <span className="w-3.5 shrink-0" />
          <span className="break-all">
            <CloseTag tagName={tagName} />
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * HTML 树视图: 用浏览器 DOMParser 解析后递归渲染, 提供格式化缩进, 语法高亮与折叠.
 * @param html 原始 HTML 文本.
 */
export function HtmlTree({ html }: { readonly html: string }): ReactElement {
  const root = useMemo(() => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.documentElement;
  }, [html]);
  return <HtmlNode node={root} />;
}
