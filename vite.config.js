import { defineConfig } from "vite";

// Keep everything relative to the folder where the project is launched.
// Do not hardcode the university H: drive: its virtual mapping can make
// absolute Windows paths resolve incorrectly inside Vite/esbuild.
export default defineConfig({
  root: ".",
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    fs: {
      strict: false
    }
  }
});
