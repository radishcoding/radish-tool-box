/*
 * monaco-editor 的类型声明只在顶层 "monaco-editor" 暴露; 这里把按需精简用到的
 * 深路径 ESM 子模块映射到同一套类型, 使只引入 JSON 语言时仍具备完整类型.
 */
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor";
}

/*
 * 该贡献模块的 .d.ts 仅为 `export {}`, 但其运行时同步导出 jsonDefaults
 * (源码 `export { getWorker, jsonDefaults }`); 这里补上用到的类型以便配置 JSON 校验.
 */
declare module "monaco-editor/esm/vs/language/json/monaco.contribution" {
  export const jsonDefaults: {
    setDiagnosticsOptions(options: {
      validate?: boolean;
      allowComments?: boolean;
      schemaValidation?: "error" | "warning" | "ignore";
      enableSchemaRequest?: boolean;
    }): void;
  };
}
