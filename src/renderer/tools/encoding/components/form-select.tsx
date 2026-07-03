import type { ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Form } from "../model/types";

/**
 * 形态选项: 源/目标通用.
 */
const FORM_OPTIONS: ReadonlyArray<{
  readonly value: Form;
  readonly label: string;
}> = [
  { value: "text", label: "可读文本" },
  { value: "hex", label: "十六进制字节" },
  { value: "base64", label: "Base64 字节" },
  { value: "unicode", label: "Unicode 码点" },
];

/**
 * 形态下拉.
 * @param value 当前形态.
 * @param onChange 选择回调.
 */
export function FormSelect({
  value,
  onChange,
}: {
  readonly value: Form;
  readonly onChange: (form: Form) => void;
}): ReactElement {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Form)}>
      <SelectTrigger className="h-7 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FORM_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
