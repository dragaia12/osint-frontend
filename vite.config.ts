import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // DuckDB-Wasm : les fichiers .wasm doivent être servis avec le bon MIME
  // et ne pas être inline-bundlés.
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  server: {
    headers: {
      // Requis pour SharedArrayBuffer (utilisé par certains bundles duckdb-wasm)
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
