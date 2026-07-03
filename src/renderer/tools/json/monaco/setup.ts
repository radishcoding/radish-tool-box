import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

// 注册 JSON 语言贡献 (其副作用注册语言与编辑器), 并取其同步导出的 jsonDefaults 配置校验
import { jsonDefaults } from "monaco-editor/esm/vs/language/json/monaco.contribution";

/*
 * 离线集成: 用本地打包的 monaco 与 worker, 不走 CDN.
 * 仅需 editor 与 json 两个 worker (本工具只编辑 JSON).
 */
const monacoEnvironment: monaco.Environment = {
  getWorker: (_workerId, label) =>
    label === "json" ? new jsonWorker() : new editorWorker(),
};
(
  globalThis as typeof globalThis & { MonacoEnvironment?: monaco.Environment }
).MonacoEnvironment = monacoEnvironment;

/**
 * 与萝卜浅色主题匹配的 Monaco 主题名 (hex 为近似值, 后续可微调).
 */
export const RADISH_LIGHT_THEME = "radish-light";

monaco.editor.defineTheme(RADISH_LIGHT_THEME, {
  base: "vs",
  inherit: true,
  rules: [
    { token: "string.key.json", foreground: "2f6f4f" },
    { token: "string.value.json", foreground: "3f7d4f" },
    { token: "string", foreground: "3f7d4f" },
    { token: "number", foreground: "b3542f" },
    { token: "keyword.json", foreground: "c0562f" },
  ],
  colors: {
    "editor.background": "#fffdf9",
    "editor.foreground": "#3a352f",
    "editorLineNumber.foreground": "#c9bfb2",
    "editor.selectionBackground": "#f7ddcf",
    "editor.lineHighlightBackground": "#fbf4ec",
  },
});

/*
 * 关闭 JSON 语言的全部校验 (语法诊断与 schema 校验): 原文视图不显示告警波浪线,
 * 也不会因 $schema 指向的远端地址发起请求. jsonDefaults 在贡献模块中同步创建,
 * 故此处 (任何编辑器创建之前) 即可可靠配置, 且 json 模式稍后加载时会读取该配置.
 */
jsonDefaults.setDiagnosticsOptions({
  validate: false,
  allowComments: true,
  schemaValidation: "ignore",
  enableSchemaRequest: false,
});

/*
 * 让 @monaco-editor/react 使用本地 monaco 实例 (主题已注册在该实例上).
 */
loader.config({ monaco });
