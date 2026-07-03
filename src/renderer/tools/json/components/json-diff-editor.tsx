import { DiffEditor } from "@monaco-editor/react";
import type { ReactElement } from "react";

import { formatJson } from "../model/format";
import { RADISH_LIGHT_THEME } from "../monaco/setup";

/**
 * 合法则格式化, 否则原样返回 (对比前抑制空白噪声).
 */
function safeFormat(text: string): string {
  try {
    return formatJson(text);
  } catch {
    return text;
  }
}

/**
 * Monaco DiffEditor 封装: 左 original 右 modified, 只读, 对比前格式化两侧.
 */
export function JsonDiffEditor({
  original,
  modified,
}: {
  readonly original: string;
  readonly modified: string;
}): ReactElement {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-card">
      <div className="absolute inset-0">
        <DiffEditor
          height="100%"
          width="100%"
          language="json"
          theme={RADISH_LIGHT_THEME}
          original={safeFormat(original)}
          modified={safeFormat(modified)}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
            scrollbar: { horizontal: "hidden" },
          }}
        />
      </div>
    </div>
  );
}
