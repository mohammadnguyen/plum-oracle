import { defineConfig } from "vite";

// 纯静态站：无后端、无环境变量、无 LLM provider 依赖。
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2022" },
  test: { globals: true, environment: "node", include: ["tests/**/*.test.ts"] },
} as any);
