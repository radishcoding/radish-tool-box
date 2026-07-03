import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor, IDisposable, IRange } from "monaco-editor";
import { useCallback, useEffect, useRef, type ReactElement } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { formatJson } from "../model/format";
import { RADISH_LIGHT_THEME } from "../monaco/setup";

/**
 * marker 归属标记, 用于清理本工具设置的 marker.
 */
const MARKER_OWNER = "json-tool";

/**
 * 源码字符区间 [start, end).
 */
export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

/**
 * 传给编辑器的解析错误 (用于打 marker).
 */
export interface JsonEditorError {
  readonly offset: number;
  readonly message: string;
}

/**
 * 把源码字符区间转换为 Monaco 的行列区间.
 */
function toMonacoRange(model: editor.ITextModel, range: SourceRange): IRange {
  const start = model.getPositionAt(range.start);
  const end = model.getPositionAt(range.end);
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

/**
 * Monaco 编辑器封装.
 *
 * 选中联动: 树/原文为互斥视图, 故进入原文 (挂载) 时按当前选中项定位一次 —
 * 仅把光标移到节点起点并滚入可见, 不做任何选区/高亮 (因此无"整值闪选"与覆盖风险);
 * 挂载后光标自由移动, 并经 onCursorOffset 反向上报当前节点.
 */
export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  language = "json",
  error,
  revealRange,
  onCursorOffset,
  formatOnPaste = false,
  onPaste,
  localizedContextMenu = false,
}: {
  readonly value: string;
  readonly onChange?: (next: string) => void;
  readonly readOnly?: boolean;
  readonly language?: string;
  readonly error?: JsonEditorError | undefined;
  readonly revealRange?: SourceRange | undefined;
  readonly onCursorOffset?: (offset: number) => void;
  readonly formatOnPaste?: boolean;
  readonly onPaste?: (text: string) => void;
  /** 为 true 时关闭 Monaco 自带英文菜单, 改用自定义中文右键菜单. */
  readonly localizedContextMenu?: boolean;
}): ReactElement {
  const editorRef = useRef<editor.IStandaloneCodeEditor | undefined>(undefined);
  const monacoRef = useRef<Monaco | undefined>(undefined);
  const disposablesRef = useRef<IDisposable[]>([]);
  // 以下 ref 让 onMount 一次性注册的监听器始终读到最新值, 而无需重注册
  const revealRangeRef = useRef(revealRange);
  revealRangeRef.current = revealRange;
  const onCursorOffsetRef = useRef(onCursorOffset);
  onCursorOffsetRef.current = onCursorOffset;
  const formatOnPasteRef = useRef(formatOnPaste);
  formatOnPasteRef.current = formatOnPaste;
  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  const applyMarkers = useCallback(() => {
    const editorInstance = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editorInstance || !monacoInstance) {
      return;
    }
    const model = editorInstance.getModel();
    if (!model) {
      return;
    }
    if (!error) {
      monacoInstance.editor.setModelMarkers(model, MARKER_OWNER, []);
      return;
    }
    const position = model.getPositionAt(error.offset);
    monacoInstance.editor.setModelMarkers(model, MARKER_OWNER, [
      {
        severity: monacoInstance.MarkerSeverity.Error,
        message: error.message,
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column + 1,
      },
    ]);
  }, [error]);

  const handleMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // 统一行尾为 LF. Monaco 模型在 Windows 默认 CRLF, 而本工具的存储文本与格式化输出
    // (lossless-json) 均为 LF; 二者不一致会让 getOffsetAt 每行多算一个 \r, 使光标定位
    // 偏到后面的节点 (检视区显示下一行的值). 强制 LF 后偏移与解析节点一致.
    editorInstance
      .getModel()
      ?.setEOL(monacoInstance.editor.EndOfLineSequence.LF);

    applyMarkers();

    // 光标移动时反向上报当前节点 (供检视区/树联动)
    disposablesRef.current.push(
      editorInstance.onDidChangeCursorPosition((event) => {
        const report = onCursorOffsetRef.current;
        const model = editorInstance.getModel();
        if (report && model) {
          report(model.getOffsetAt(event.position));
        }
      }),
    );

    // 粘贴: 整篇若是合法 JSON 则自动格式化 (否则保持原样), 再上报最终文本
    disposablesRef.current.push(
      editorInstance.onDidPaste(() => {
        const model = editorInstance.getModel();
        if (!model) {
          return;
        }
        let text = model.getValue();
        if (formatOnPasteRef.current) {
          try {
            const formatted = formatJson(text);
            if (formatted !== text) {
              editorInstance.executeEdits("format-on-paste", [
                { range: model.getFullModelRange(), text: formatted },
              ]);
              text = formatted;
            }
          } catch {
            // 整篇非合法 JSON, 不格式化
          }
        }
        onPasteRef.current?.(text);
      }),
    );

    // 进入视图时定位到当前选中项: 仅移动光标到节点起点 + 滚入可见 (无选区/无高亮)
    const initial = revealRangeRef.current;
    const model = editorInstance.getModel();
    if (initial && model) {
      const range = toMonacoRange(model, initial);
      editorInstance.setPosition({
        lineNumber: range.startLineNumber,
        column: range.startColumn,
      });
      editorInstance.revealRangeInCenter(range);
    }
  };

  // 卸载时释放本组件注册的全部监听器
  useEffect(
    () => () => {
      for (const disposable of disposablesRef.current) {
        disposable.dispose();
      }
      disposablesRef.current = [];
    },
    [],
  );

  useEffect(() => {
    applyMarkers();
  }, [applyMarkers]);

  // 触发一个内置编辑器动作 (供自定义中文右键菜单调用); 先聚焦再 trigger 以保住选区与剪贴板权限
  const runEditorAction = useCallback((actionId: string): void => {
    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }
    editorInstance.focus();
    editorInstance.trigger("context-menu", actionId, null);
  }, []);

  // 绝对定位 + overflow-hidden 外壳: 让 Monaco 测量的尺寸只由父级驱动, 与自身内容无关,
  // 从根上断开 automaticLayout 的 ResizeObserver 反馈环 (压低高度时滚动条不再抖动)
  const editorElement = (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Editor
          height="100%"
          width="100%"
          language={language}
          theme={RADISH_LIGHT_THEME}
          value={value}
          onChange={(next) => onChange?.(next ?? "")}
          onMount={handleMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            tabSize: 2,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
            // 关闭 Monaco 的出现项/选区高亮: 点击 token 时不再给整个值加淡阴影
            occurrencesHighlight: "off",
            selectionHighlight: false,
            // 已开 wordWrap, 横向滚动条本不需要; 关掉它避免与纵向滚动条互馈
            scrollbar: { horizontal: "hidden" },
            // 启用自定义中文右键菜单时, 关闭 Monaco 自带英文菜单
            contextmenu: !localizedContextMenu,
          }}
        />
      </div>
    </div>
  );

  if (!localizedContextMenu) {
    return editorElement;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{editorElement}</ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        <ContextMenuItem
          onSelect={() => runEditorAction("editor.action.clipboardCutAction")}
        >
          剪切
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => runEditorAction("editor.action.clipboardCopyAction")}
        >
          复制
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => runEditorAction("editor.action.clipboardPasteAction")}
        >
          粘贴
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => runEditorAction("editor.action.selectAll")}
        >
          全选
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => runEditorAction("editor.action.formatDocument")}
        >
          格式化文档
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
