import { defineConfig } from "vite";

// ws / socket.io-client / mqtt 依赖的 bufferutil 与 utf-8-validate 是可选原生加速模块,
// 未安装时这些库会 try/catch 回退到纯 JS 实现. 打包器无法静态解析它们, 故标记为 external,
// 让运行时按可选依赖处理 (require 失败被库自身捕获), 避免主进程启动崩溃.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["bufferutil", "utf-8-validate"],
    },
  },
});
