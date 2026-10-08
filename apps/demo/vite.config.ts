import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 独立高保真 Demo：纯前端 mock，不代理任何后端。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 9119 },
});
