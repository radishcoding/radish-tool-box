import { Copy } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { IconAction } from "@/components/common/icon-action";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";

import { findCharset } from "../model/charsets";
import { formNeedsCharset, type Form } from "../model/types";
import { CharsetSelect } from "./charset-select";
import { FormSelect } from "./form-select";

/**
 * 单侧编解码栏: 源 (可编辑) 与目标 (只读) 共用.
 * @param title 栏标题.
 * @param form 当前形态.
 * @param charset 当前字符集 id.
 * @param text 文本内容.
 * @param readOnly 是否只读 (目标栏).
 * @param onFormChange 形态变更回调.
 * @param onCharsetChange 字符集变更回调.
 * @param onTextChange 文本变更回调 (只读栏可省略).
 * @param extra 标题行右侧附加控件 (如探测按钮).
 */
export function CodecPane({
  title,
  form,
  charset,
  text,
  readOnly = false,
  onFormChange,
  onCharsetChange,
  onTextChange,
  extra,
}: {
  readonly title: string;
  readonly form: Form;
  readonly charset: string;
  readonly text: string;
  readonly readOnly?: boolean;
  readonly onFormChange: (form: Form) => void;
  readonly onCharsetChange: (id: string) => void;
  readonly onTextChange?: (text: string) => void;
  readonly extra?: ReactNode;
}): ReactElement {
  const showCharset = formNeedsCharset(form);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <FormSelect value={form} onChange={onFormChange} />
        {showCharset && (
          <CharsetSelect value={charset} onChange={onCharsetChange} />
        )}
        {showCharset && findCharset(charset) === undefined && (
          <span className="text-xs text-destructive">未知字符集</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {extra}
          {readOnly && (
            <IconAction
              icon={Copy}
              label="复制结果"
              onClick={() => void copyText(text)}
            />
          )}
        </div>
      </div>
      <Textarea
        value={text}
        readOnly={readOnly}
        onChange={(e) => onTextChange?.(e.target.value)}
        placeholder={readOnly ? "结果" : "输入内容"}
        className="min-h-0 flex-1 resize-none bg-muted/40 font-mono text-xs"
      />
    </div>
  );
}
