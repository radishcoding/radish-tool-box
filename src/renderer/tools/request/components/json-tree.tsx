import { useState, type ReactElement } from "react";

import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { JsonValue } from "../model/response";

/**
 * 判断是否为可折叠容器 (对象或数组, 排除 null).
 * @param value JSON 值.
 * @returns 是容器返回 true.
 */
function isContainer(
  value: JsonValue,
): value is readonly JsonValue[] | { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null;
}

/**
 * 渲染 JSON 基本值 (字符串/数字/布尔/null), 按类型着色.
 * @param value 基本值.
 */
function JsonLeaf({ value }: { readonly value: JsonValue }): ReactElement {
  if (typeof value === "string") {
    return <span className="text-emerald-600">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-amber-600">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-600">{String(value)}</span>;
  }
  return <span className="text-muted-foreground italic">null</span>;
}

/**
 * 渲染键名前缀 ("key": ), 无键 (数组元素/根) 时返回 null.
 * @param propertyKey 键名.
 */
function KeyLabel({
  propertyKey,
}: {
  readonly propertyKey: string | undefined;
}): ReactElement | null {
  if (propertyKey === undefined) {
    return null;
  }
  return (
    <>
      <span className="text-sky-600">{JSON.stringify(propertyKey)}</span>
      <span className="text-muted-foreground">: </span>
    </>
  );
}

/**
 * 递归渲染一个 JSON 节点; 容器可点击折叠, 折叠时显示计数摘要.
 * @param propertyKey 该节点的键名 (数组元素/根为 undefined).
 * @param value 节点值.
 * @param isLast 是否为同级最后一项 (决定是否补逗号).
 */
function JsonNode({
  propertyKey,
  value,
  isLast,
}: {
  readonly propertyKey?: string;
  readonly value: JsonValue;
  readonly isLast: boolean;
}): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const comma = isLast ? null : (
    <span className="text-muted-foreground">,</span>
  );

  // 基本值: 空槽对齐 + 键 + 值.
  if (!isContainer(value)) {
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span className="min-w-0 break-all">
          <KeyLabel propertyKey={propertyKey} />
          <JsonLeaf value={value} />
          {comma}
        </span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: readonly (readonly [string | undefined, JsonValue])[] = isArray
    ? value.map((item) => [undefined, item] as const)
    : Object.entries(value);
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const count = entries.length;
  const unit = isArray ? "项" : "键";

  // 空容器: 单行 {} / [], 无折叠.
  if (count === 0) {
    return (
      <div className="flex items-start">
        <span className="w-3.5 shrink-0" />
        <span>
          <KeyLabel propertyKey={propertyKey} />
          <span className="text-muted-foreground">
            {open}
            {close}
          </span>
          {comma}
        </span>
      </div>
    );
  }

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
        <span className="min-w-0 break-all">
          <KeyLabel propertyKey={propertyKey} />
          <span className="text-muted-foreground">{open}</span>
          {collapsed && (
            <>
              <span className="text-muted-foreground">…{close}</span>
              {comma}
              <span className="ml-1.5 text-muted-foreground/70">
                {count} {unit}
              </span>
            </>
          )}
        </span>
      </div>
      {!collapsed && (
        <div className="ml-[7px] border-l border-border/60 pl-3">
          {entries.map(([childKey, childValue], index) => (
            <JsonNode
              key={isArray ? index : childKey}
              propertyKey={childKey}
              value={childValue}
              isLast={index === count - 1}
            />
          ))}
        </div>
      )}
      {!collapsed && (
        <div className="flex items-start">
          <span className="w-3.5 shrink-0" />
          <span>
            <span className="text-muted-foreground">{close}</span>
            {comma}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * JSON 树视图: 语法高亮 + 可折叠对象/数组, 用于响应体 Pretty 页.
 * @param value 已解析的 JSON 值 (通常为对象或数组).
 */
export function JsonTree({
  value,
}: {
  readonly value: JsonValue;
}): ReactElement {
  return <JsonNode value={value} isLast />;
}
