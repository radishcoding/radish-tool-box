import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  bytesToBase64,
  bytesToText,
  collectCookies,
  decodeBase64Chunks,
  deriveFileName,
  detectBodyKind,
  injectBaseHref,
  singleHeaderValue,
  tryParseJson,
} from "../model/response";
import type { ResponseState } from "../model/types";
import { BodyToolbar, SearchBar } from "./body-toolbar";
import { HtmlTree } from "./html-tree";
import { JsonTree } from "./json-tree";
import { useContentSearch } from "./use-content-search";

/**
 * Pretty 页树视图 (JSON/HTML) 的滚动容器样式.
 */
const TREE_CONTAINER_CLASS =
  "h-full min-h-64 overflow-auto rounded bg-muted/40 p-3 font-mono text-xs leading-relaxed";

/**
 * 状态码配色.
 */
function statusColor(status: number): string {
  if (status >= 200 && status < 300) {
    return "text-emerald-600";
  }
  if (status >= 300 && status < 400) {
    return "text-amber-600";
  }
  if (status >= 400) {
    return "text-red-600";
  }
  return "text-muted-foreground";
}

/**
 * 人类可读的字节数.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * 响应区: 状态/耗时/大小 + Body(Pretty/Raw/Preview)/Headers/Cookies/Timeline.
 * @param response 当前标签的响应状态 (可能为空).
 */
export function ResponsePanel({
  response,
}: {
  readonly response: ResponseState | undefined;
}): ReactElement {
  const chunks = response?.chunks;
  const bytes = useMemo(
    () => (chunks ? decodeBase64Chunks(chunks) : new Uint8Array()),
    [chunks],
  );
  const text = useMemo(() => bytesToText(bytes), [bytes]);
  const contentType = response
    ? singleHeaderValue(response.headers["content-type"])
    : "";
  // 汇总"这次请求相关"的 cookie: 请求带出的 (sent) + 整条链设置的 (set, 含重定向跳).
  const cookies = response
    ? collectCookies({
        setCookie: [...response.cookies],
        sent: response.sentCookie,
      })
    : [];

  if (response === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        发送请求后在此查看响应
      </div>
    );
  }

  if (response.phase === "running") {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        请求中...
      </div>
    );
  }

  if (response.phase === "cancelled") {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        已取消
      </div>
    );
  }

  if (response.phase === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-xs">
        <span className="font-medium text-red-600">请求失败</span>
        <span className="text-muted-foreground">{response.error}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b px-3 py-1.5 text-xs">
        <span className={`font-medium ${statusColor(response.statusCode)}`}>
          {response.statusCode} {response.statusText}
        </span>
        <span className="font-mono text-muted-foreground">
          {response.timeMs} ms
        </span>
        <span className="font-mono text-muted-foreground">
          {formatSize(bytes.length)}
        </span>
      </div>
      <Tabs defaultValue="body" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-9 shrink-0 justify-start rounded-none border-b bg-transparent px-2">
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers ({Object.keys(response.headers).length})
          </TabsTrigger>
          <TabsTrigger value="cookies" className="text-xs">
            Cookies ({cookies.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Timeline
          </TabsTrigger>
          <TabsTrigger
            value="tests"
            className={cn(
              "text-xs",
              response.tests.some((t) => !t.passed) && "text-red-600",
            )}
          >
            Tests ({response.tests.filter((t) => t.passed).length}/
            {response.tests.length})
          </TabsTrigger>
          <TabsTrigger value="console" className="text-xs">
            Console ({response.logs.length})
          </TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {/* body 页需撑满高度, 使内部 Preview iframe / 树视图能占满可用空间. */}
          <TabsContent value="body" className="h-full">
            <ResponseBody
              text={text}
              contentType={contentType}
              bytes={bytes}
              url={response.url}
            />
          </TabsContent>
          <TabsContent value="headers">
            <table className="w-full text-left text-xs">
              <tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-b">
                    <td className="py-1 pr-3 font-mono font-medium text-muted-foreground">
                      {key}
                    </td>
                    <td className="py-1 font-mono break-all">
                      {singleHeaderValue(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
          <TabsContent value="cookies">
            {cookies.length === 0 ? (
              <p className="text-xs text-muted-foreground">无 Cookie</p>
            ) : (
              <table className="w-full text-left text-xs">
                <tbody>
                  {cookies.map((c) => (
                    <tr key={c.name} className="border-b">
                      <td className="py-1 pr-3 font-mono font-medium text-muted-foreground">
                        {c.name}
                      </td>
                      <td className="py-1 pr-3 font-mono break-all">
                        {c.value}
                      </td>
                      <td className="py-1 whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            c.source === "set"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-sky-500/10 text-sky-600",
                          )}
                        >
                          {c.source === "set" ? "已设置" : "已发送"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
          <TabsContent value="timeline">
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0">总耗时</span>
                <span className="font-mono">{response.timeMs} ms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0">响应大小</span>
                <span className="font-mono">{formatSize(bytes.length)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0">HTTP 版本</span>
                <span className="font-mono">{response.httpVersion}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0">状态</span>
                <span
                  className={`font-mono font-medium ${statusColor(response.statusCode)}`}
                >
                  {response.statusCode} {response.statusText}
                </span>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tests">
            {response.tests.length === 0 ? (
              <p className="text-xs text-muted-foreground">无断言</p>
            ) : (
              <div className="flex flex-col gap-1 text-xs">
                {response.tests.map((t, i) => (
                  <div
                    key={`${t.name}-${i}`}
                    className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/40"
                  >
                    <span
                      className={t.passed ? "text-emerald-600" : "text-red-600"}
                    >
                      {t.passed ? "通过" : "失败"}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-foreground">{t.name}</span>
                      {!t.passed && (
                        <span className="font-mono text-red-600/80">
                          {t.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="console">
            {response.logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">无日志</p>
            ) : (
              <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                {response.logs.join("\n")}
              </pre>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/**
 * 响应体视图: Pretty/Raw/Preview 三态.
 */
function ResponseBody({
  text,
  contentType,
  bytes,
  url,
}: {
  readonly text: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
  readonly url: string;
}): ReactElement {
  const kind = detectBodyKind(contentType);
  // JSON 体解析一次: 成功且为对象/数组时用可折叠树视图, 否则回退纯文本.
  const parsed = useMemo(() => tryParseJson(text), [text]);
  // 是否在预览中执行页面脚本 (默认开启: 更接近真实浏览器渲染; 关闭则仅加载静态资源, 更安全).
  const [runScripts, setRunScripts] = useState(true);
  const [bodyTab, setBodyTab] = useState("pretty");
  const [wrap, setWrap] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // 搜索作用于当前可见分页; contentKey 随分页/内容变化触发重算.
  const search = useContentSearch(
    contentRef,
    searchOpen ? term : "",
    `${bodyTab}|${text.length}`,
  );

  // HTML 预览注入 <base href>, 使相对资源按原始地址加载.
  const previewHtml = useMemo(
    () => (kind === "html" ? injectBaseHref(text, url) : ""),
    [kind, text, url],
  );
  // 图片预览用 Blob URL: 创建后在依赖变化/卸载时 revoke, 避免 URL 泄漏.
  const [imageUrl, setImageUrl] = useState("");
  useEffect(() => {
    if (kind !== "image") {
      setImageUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: contentType }),
    );
    setImageUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes, contentType, kind]);

  // 复制成功后短暂反馈.
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = (): void => {
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  const handleSave = (): void => {
    void window.fileApi.saveFile({
      defaultName: deriveFileName(url, contentType),
      base64: bytesToBase64(bytes),
    });
  };

  const showJsonTree =
    kind === "json" &&
    parsed.ok &&
    typeof parsed.value === "object" &&
    parsed.value !== null;

  return (
    <Tabs
      value={bodyTab}
      onValueChange={setBodyTab}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <TabsList className="h-7 w-fit">
          <TabsTrigger value="pretty" className="text-xs">
            Pretty
          </TabsTrigger>
          <TabsTrigger value="raw" className="text-xs">
            Raw
          </TabsTrigger>
          {(kind === "html" || kind === "image") && (
            <TabsTrigger value="preview" className="text-xs">
              Preview
            </TabsTrigger>
          )}
        </TabsList>
        {bodyTab !== "preview" && (
          <BodyToolbar
            searchOpen={searchOpen}
            onToggleSearch={() => setSearchOpen((o) => !o)}
            wrap={wrap}
            onToggleWrap={() => setWrap((w) => !w)}
            copied={copied}
            onCopy={handleCopy}
            onSave={handleSave}
          />
        )}
      </div>
      {searchOpen && bodyTab !== "preview" && (
        <SearchBar
          term={term}
          onTermChange={setTerm}
          count={search.count}
          activeIndex={search.activeIndex}
          onNext={search.goNext}
          onPrev={search.goPrev}
          onClose={() => {
            setSearchOpen(false);
            setTerm("");
          }}
        />
      )}
      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
        <TabsContent value="pretty" className="min-h-0 flex-1">
          {showJsonTree && parsed.ok ? (
            <div className={TREE_CONTAINER_CLASS}>
              <JsonTree value={parsed.value} />
            </div>
          ) : kind === "html" && text.trim() !== "" ? (
            <div className={TREE_CONTAINER_CLASS}>
              <HtmlTree html={text} />
            </div>
          ) : (
            <TextView text={text} wrap={wrap} />
          )}
        </TabsContent>
        <TabsContent value="raw" className="min-h-0 flex-1">
          <TextView text={text} wrap={wrap} />
        </TabsContent>
        <TabsContent value="preview" className="flex min-h-0 flex-1 flex-col">
          {kind === "image" ? (
            <img
              src={imageUrl}
              alt="响应预览"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <>
              <label className="mb-2 flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={runScripts}
                  onCheckedChange={(v) => setRunScripts(v === true)}
                />
                运行脚本 (完整渲染, 会执行页面远程 JS)
              </label>
              <iframe
                title="响应预览"
                // 默认禁脚本 (仅加载静态资源); 勾选后允许脚本以接近真实浏览器渲染.
                sandbox={runScripts ? "allow-scripts allow-popups" : ""}
                srcDoc={previewHtml}
                className="min-h-0 w-full flex-1 rounded border bg-white"
              />
            </>
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}

/**
 * 只读文本视图: 用 pre 渲染 (可选中复制, 文本为 DOM 便于搜索高亮), 支持换行开关.
 * @param text 文本内容.
 * @param wrap 是否自动换行.
 */
function TextView({
  text,
  wrap,
}: {
  readonly text: string;
  readonly wrap: boolean;
}): ReactElement {
  return (
    <pre
      className={cn(
        "h-full min-h-64 overflow-auto rounded bg-muted/40 p-3 font-mono text-xs",
        wrap ? "break-all whitespace-pre-wrap" : "whitespace-pre",
      )}
    >
      {text}
    </pre>
  );
}
