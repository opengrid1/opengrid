import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT and BASE_PATH are required at *runtime* (the dev/preview server binds
// to PORT, the bundle expects assets under BASE_PATH). For `vite build` they
// fall back to sensible defaults so CI/production build pipelines don't need
// to wire env vars just to produce the bundle.
const isBuild = process.argv.includes("build");
const port = Number(process.env.PORT ?? (isBuild ? 5173 : NaN));
if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error("PORT environment variable is required for dev/preview.");
}
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
