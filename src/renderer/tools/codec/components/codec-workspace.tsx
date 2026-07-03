import { ArrowRightLeft, Copy, X } from "lucide-react";
import { useEffect, type ReactElement } from "react";

import { CharsetSelect } from "@/components/common/charset-select";
import { Diagnostics } from "@/components/common/diagnostics";
import { IconAction } from "@/components/common/icon-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { HexFormat } from "@/lib/charset/hex";
import { copyText } from "@/lib/clipboard";

import { findCodec } from "../model/registry";
import { runCodec } from "../model/run";
import { useCodecStore } from "../store/codec-store";
import { CodecOptions } from "./codec-options";

/**
 * 空选项对象常量, 保证未初始化时引用稳定.
 */
const EMPTY_OPTIONS: Readonly<Record<string, string>> = {};

/**
 * Hex 显示格式选项 (与编码转换的 FORMAT_OPTIONS 完全一致).
 */
const FORMAT_OPTIONS: ReadonlyArray<{
  readonly value: HexFormat;
  readonly label: string;
}> = [
  { value: "none", label: "无" },
  { value: "space", label: "空格" },
  { value: "dash", label: "连字符" },
  { value: "array-hex", label: "0x 数组" },
  { value: "array-dec", label: "十进制数组" },
];

/**
 * 编码解码工作区: 顶部操作条 + 左右输入输出双栏 + 底部诊断区, 防抖实时计算 (150ms).
 *
 * effect 稳定化: 通过 `useCodecStore((s) => s.options[s.codecId])` 直接订阅
 * 当前 codec 的选项子对象. Zustand 只在该对象引用发生变化时触发重渲染,
 * 而非每次渲染都派生新对象, 从而保证 useEffect 依赖列表的引用稳定, 避免无限/抖动触发.
 */
export function CodecWorkspace(): ReactElement {
  // 逐个订阅状态, 与 encoding-workspace 做法一致.
  const codecId = useCodecStore((s) => s.codecId);
  const direction = useCodecStore((s) => s.direction);
  const charset = useCodecStore((s) => s.charset);
  const hex = useCodecStore((s) => s.hex);
  const input = useCodecStore((s) => s.input);
  const result = useCodecStore((s) => s.result);

  // 直接订阅当前 codec 的选项子对象, 引用稳定.
  const codecOptions = useCodecStore(
    (s) => s.options[s.codecId] ?? EMPTY_OPTIONS,
  );

  const setDirection = useCodecStore((s) => s.setDirection);
  const setCharset = useCodecStore((s) => s.setCharset);
  const setHex = useCodecStore((s) => s.setHex);
  const setInput = useCodecStore((s) => s.setInput);
  const setOption = useCodecStore((s) => s.setOption);
  const setResult = useCodecStore((s) => s.setResult);

  const codec = findCodec(codecId);

  // 当前方向下输出端是否为十六进制: Hex codec, 或进制转换的输出进制为 16.
  // (进制转换 encode 输出端是 to, decode 输出端是 from; 取各自默认值兜底.)
  const radixOutputBase =
    direction === "encode"
      ? (codecOptions.to ?? "16")
      : (codecOptions.from ?? "10");
  const showHexOptions =
    codecId === "hex" || (codecId === "radix" && radixOutputBase === "16");

  // 码表选项单独拎出, 放到工具条末尾且带清空按钮; 其余选项照常前置.
  const alphabetOption = codec?.options?.find((o) => o.id === "alphabet");
  const mainOptions = codec?.options?.filter((o) => o.id !== "alphabet") ?? [];
  const alphabetValue =
    alphabetOption !== undefined
      ? (codecOptions[alphabetOption.id] ?? alphabetOption.defaultValue)
      : "";

  // 防抖实时计算; codecOptions 引用稳定, 不会无限触发.
  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(
        runCodec(codecId, direction, input, {
          charset,
          hex,
          options: codecOptions,
        }),
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [codecId, direction, input, charset, hex, codecOptions, setResult]);

  const outputText = result.error !== "" ? result.error : result.output;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 顶部操作条 */}
      <div className="flex h-10 shrink-0 flex-wrap items-center gap-3 border-b px-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          {codec?.label ?? "编码解码"}
        </span>

        {/* 编码/解码方向切换 */}
        <div className="flex items-center gap-1">
          <Button
            variant={direction === "encode" ? "default" : "ghost"}
            size="sm"
            className="h-7 cursor-pointer"
            onClick={() => setDirection("encode")}
          >
            编码
          </Button>
          <Button
            variant={direction === "decode" ? "default" : "ghost"}
            size="sm"
            className="h-7 cursor-pointer"
            onClick={() => setDirection("decode")}
          >
            解码
          </Button>
        </div>

        {/* codec 专属选项 (码表除外, 码表置于工具条末尾) */}
        {mainOptions.length > 0 && (
          <CodecOptions
            options={mainOptions}
            values={codecOptions}
            onChange={(optionId, value) => setOption(codecId, optionId, value)}
          />
        )}

        {/* 字符集选择 (需字符集的 codec 才显示) */}
        {codec?.needsCharset === true && (
          <CharsetSelect value={charset} onChange={setCharset} />
        )}

        {/* Hex 显示形态: 大小写切换 + 显示格式 (Hex codec 或进制转换输出为 16 时显示) */}
        {showHexOptions && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch
                checked={hex.upperCase}
                onCheckedChange={(v) => setHex({ upperCase: v })}
              />
              大写
            </label>
            <Select
              value={hex.format}
              onValueChange={(v) => setHex({ format: v as HexFormat })}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {/* 码表 (置于末尾, 占满剩余空间, 带清空按钮) */}
        {alphabetOption !== undefined && (
          <label className="ml-auto flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
            {alphabetOption.label}
            <div className="relative min-w-0 flex-1">
              <Input
                value={alphabetValue}
                onChange={(e) =>
                  setOption(codecId, alphabetOption.id, e.target.value)
                }
                placeholder={alphabetOption.placeholder}
                spellCheck={false}
                className="h-7 w-full pr-7 font-mono text-xs"
              />
              {alphabetValue !== "" && (
                <button
                  type="button"
                  aria-label="清空码表"
                  onClick={() => setOption(codecId, alphabetOption.id, "")}
                  className="absolute top-1/2 right-1.5 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </label>
        )}
      </div>

      {/* 输入/输出双栏 */}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* 输入栏 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center">
            <span className="text-sm font-medium text-muted-foreground">
              输入
            </span>
            <div className="ml-auto">
              <IconAction
                icon={Copy}
                label="复制输入"
                onClick={() => void copyText(input)}
              />
            </div>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入内容"
            className="min-h-0 flex-1 resize-none bg-muted/40 font-mono text-xs"
          />
        </div>

        {/* 中间切换方向图标 */}
        <div className="flex items-center">
          <IconAction
            icon={ArrowRightLeft}
            label="切换编码/解码方向"
            onClick={() =>
              setDirection(direction === "encode" ? "decode" : "encode")
            }
          />
        </div>

        {/* 输出栏 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center">
            <span className="text-sm font-medium text-muted-foreground">
              输出
            </span>
            <div className="ml-auto">
              <IconAction
                icon={Copy}
                label="复制结果"
                onClick={() => void copyText(result.output)}
              />
            </div>
          </div>
          <Textarea
            value={outputText}
            readOnly
            placeholder="结果"
            className="min-h-0 flex-1 resize-none bg-muted/40 font-mono text-xs"
          />
        </div>
      </div>

      {/* 底部诊断区 */}
      <div className="shrink-0 px-3 pb-3">
        <Diagnostics items={result.diagnostics} />
      </div>
    </div>
  );
}
