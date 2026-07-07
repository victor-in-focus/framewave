import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    // ffmpeg.wasm spawns its own module worker; esbuild pre-bundling breaks
    // the worker's relative URL resolution, so keep these packages untouched.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"]
  },
  test: {
    environment: "node",
    globals: true
  }
});
