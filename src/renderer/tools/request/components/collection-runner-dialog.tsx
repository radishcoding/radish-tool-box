import { Loader2 } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { runCollectionById } from "@/hooks/use-collection-runner";
import type { DataFormat, RunSummary } from "../model/runner";

/** 数据格式选项. */
const DATA_FORMATS: ReadonlyArray<{
  readonly id: DataFormat;
  readonly label: string;
}> = [
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
];

/**
 * 集合运行器对话框: 配置数据源 + 运行 + 进度 + 结果表 + 总览.
 * @param open 是否打开.
 * @param collectionId 目标集合 id (undefined 时不执行运行).
 * @param collectionName 集合名称 (标题展示).
 * @param onOpenChange 开关回调.
 */
export function CollectionRunnerDialog({
  open,
  collectionId,
  collectionName,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly collectionId: string | undefined;
  readonly collectionName: string;
  readonly onOpenChange: (open: boolean) => void;
}): ReactElement {
  const [dataText, setDataText] = useState("");
  const [format, setFormat] = useState<DataFormat>("json");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [summary, setSummary] = useState<RunSummary | undefined>(undefined);
  const [error, setError] = useState("");

  /** 异步执行集合运行, 更新进度与汇总. */
  const run = async (): Promise<void> => {
    if (collectionId === undefined) {
      return;
    }
    setRunning(true);
    setError("");
    setSummary(undefined);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await runCollectionById(
        collectionId,
        dataText,
        format,
        (done, total) => {
          setProgress({ done, total });
        },
      );
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm font-semibold">
            运行集合: {collectionName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            顺序运行集合内全部请求, 可选数据源驱动迭代, 汇总断言结果.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-auto p-4">
          {/* 数据源标签 + 格式切换 (分段按钮组) + 运行按钮 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">数据源 (可选)</span>
            <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
              {DATA_FORMATS.map((f) => (
                <Button
                  key={f.id}
                  variant="ghost"
                  size="sm"
                  aria-pressed={format === f.id}
                  onClick={() => {
                    setFormat(f.id);
                  }}
                  className={cn(
                    "h-6 cursor-pointer px-2.5 text-xs transition-all",
                    format === f.id
                      ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              className="ml-auto h-7 cursor-pointer gap-1.5 px-3 text-xs"
              disabled={running}
              onClick={() => {
                void run();
              }}
            >
              {running ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  {`${progress.done}/${progress.total}`}
                </>
              ) : (
                "运行"
              )}
            </Button>
          </div>

          {/* 数据源文本框 */}
          <Textarea
            value={dataText}
            placeholder={
              format === "csv"
                ? "name,age\nalice,30\nbob,25"
                : '[{"name":"alice"},{"name":"bob"}]'
            }
            spellCheck={false}
            onChange={(e) => {
              setDataText(e.target.value);
            }}
            className="h-24 resize-none font-mono text-xs"
          />

          {/* 错误提示 */}
          {error !== "" && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          {/* 总览 + 结果表 */}
          {summary !== undefined && (
            <div className="flex flex-col gap-2">
              {/* 总览统计行 */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  迭代{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {summary.iterations}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  请求{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {summary.totalRequests}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  断言{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {summary.totalAssertions}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  通过{" "}
                  <span className="font-medium tabular-nums text-emerald-600">
                    {summary.passed}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  失败{" "}
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      summary.failed > 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {summary.failed}
                  </span>
                </span>
              </div>

              {/* 结果表 */}
              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                        迭代
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                        请求
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                        状态
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                        耗时
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                        断言
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.results.map((r) => {
                      const passedCount = r.tests.filter(
                        (t) => t.passed,
                      ).length;
                      const failedCount = r.tests.length - passedCount;
                      const rowKey = `${r.requestId}-${r.iteration}`;
                      return (
                        <tr
                          key={rowKey}
                          className="border-t transition-colors hover:bg-muted/30"
                        >
                          <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                            {r.iteration + 1}
                          </td>
                          <td className="max-w-[160px] truncate px-3 py-1.5">
                            {r.requestName}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {r.error !== "" ? (
                              <span
                                className="text-destructive"
                                title={r.error}
                              >
                                err
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  r.statusCode >= 400
                                    ? "text-destructive"
                                    : r.statusCode >= 200
                                      ? "text-emerald-600"
                                      : "text-muted-foreground",
                                )}
                              >
                                {r.statusCode}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                            {r.timeMs} ms
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {r.tests.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <>
                                <span className="text-emerald-600">
                                  {passedCount}
                                </span>
                                {failedCount > 0 && (
                                  <span className="text-destructive">
                                    {" "}
                                    / {failedCount}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
