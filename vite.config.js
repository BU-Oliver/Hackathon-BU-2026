import { defineConfig } from "vite";

// IMPORTANT:
// Do not hardcode the H: drive as Vite's root. Bournemouth University's
// mapped H: drive is virtualised, and Node/esbuild can resolve an absolute
// H: path through the university's backing path. Let Vite use the directory
// from which npm is launched instead.
export default defineConfig({
  root: ".",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    fs: {
      strict: false
    }
  },
  optimizeDeps: {
    entries: ["index.html"]
  }
});
