import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发时把 /api 代理到本地 hermes dashboard（默认 127.0.0.1:9119）。
// 生产构建产物由 `HERMES_WEB_DIST=dist hermes dashboard --skip-build` 托管。
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:9119", changeOrigin: true, ws: true },
    },
  },
  // e2e：`vite preview` 也把 REST 与 WebSocket 转发到本地 BFF（4599）。
  preview: {
    proxy: {
      "/api": { target: "http://127.0.0.1:4599", changeOrigin: true, ws: true },
    },
  },
});
