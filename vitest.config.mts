import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/*
 * Vitest 配置: 复用渲染层的 @ 别名, model 层为纯逻辑故用 node 环境.
 * 命名为 .mts 与渲染层 vite 配置一致 (ESM-only 插件兼容, 不改 package.json 的 type).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/renderer", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
