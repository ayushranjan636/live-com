/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built dist/ folder can be served from any local path at the booth.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", chunkSizeWarningLimit: 1500 },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
