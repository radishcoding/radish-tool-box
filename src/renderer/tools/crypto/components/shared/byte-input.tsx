import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { sortByLength } from "@/lib/sort-by-length";

import type { ByteEncoding, EncodedBytes } from "../../model/types";

/**
 * 字节编码下拉选项, 供输入框与结果框共用.
 */
export const BYTE_ENCODING_OPTIONS: ReadonlyArray<{
  readonly value: ByteEncoding;
  readonly label: string;
}> = [
  { value: "utf8", label: "UTF-8" },
  { value: "hex", label: "Hex" },
  { value: "base64", label: "Base64" },
];

/**
 * ByteInput 组件属性.
 */
export interface ByteInputProps {
  readonly label: string;
  readonly value: EncodedBytes;
  readonly onChange: (value: EncodedBytes) => void;
  readonly multiline?: boolean;
  readonly placeholder?: string;
}

/**
 * 带编码选择的字节输入框: 文本可在 UTF-8/Hex/Base64 间切换语义.
 */
export function ByteInput({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: ByteInputProps): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Select
          value={value.encoding}
          onValueChange={(encoding) =>
            onChange({ ...value, encoding: encoding as ByteEncoding })
          }
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
      </div>
      {multiline ? (
        <Textarea
          value={value.text}
          placeholder={placeholder}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          className="min-h-24 font-mono text-xs"
        />
      ) : (
        <Input
          value={value.text}
          placeholder={placeholder}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
