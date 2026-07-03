import { Copy } from "lucide-react";
import type { ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";
import { sortByLength } from "@/lib/sort-by-length";

import type { ResultView } from "../../model/result-view";
import type { ByteEncoding } from "../../model/types";
import { BYTE_ENCODING_OPTIONS } from "./byte-input";

/**
 * ResultOutput 组件属性.
 */
export interface ResultOutputProps {
  readonly label: string;
  readonly value: ResultView;
  readonly encoding: ByteEncoding;
  readonly onEncodingChange: (encoding: ByteEncoding) => void;
}

/**
 * 只读结果框: 展示输出文本, 支持切换输出编码与一键复制.
 */
export function ResultOutput({
  label,
  value,
  encoding,
  onEncodingChange,
}: ResultOutputProps): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <Select
            value={encoding}
            onValueChange={(next) => onEncodingChange(next as ByteEncoding)}
          >
            <SelectTrigger className="h-6 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortByLength(BYTE_ENCODING_OPTIONS, (o) => o.label).map(
                (option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <IconAction
            icon={Copy}
            label="复制结果"
            onClick={() => void copyText(value.output)}
          />
        </div>
      </div>
      <Textarea
        readOnly
        value={value.output}
        placeholder="结果"
        className="min-h-24 flex-1 bg-muted/40 font-mono text-xs"
      />
    </div>
  );
}
