import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  /*
   * 开发服务器显式绑定 IPv4 回环. Vite 默认监听 "localhost", 而 Node 18+ 保持系统返回的
   * DNS 顺序, 在本机上 localhost 优先解析为 ::1, 于是服务器只在 IPv6 回环监听; 主进程
   * 加载的地址由 Electron Forge 固定拼为 http://localhost:<port>, 一旦 IPv6 回环不可用
   * (被安全策略拦截或系统关闭) 就会 ERR_CONNECTION_REFUSED 白屏. 绑定 127.0.0.1 后
   * localhost 必定能解析到监听地址, 且不向局域网暴露开发服务器.
   */
  server: {
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src/renderer"),
    },
  },
  optimizeDeps: {
    include: ["monaco-editor"],
  },
});
