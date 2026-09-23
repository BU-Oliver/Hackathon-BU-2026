import { defineConfig } from "vite";
import { resolve } from "node:path";

// Bournemouth University mapped H: drive project location.
// This prevents Vite from resolving /src/main.js against the university
// web/home directory when the project is launched from the wrong working directory.
const PROJECT_ROOT = "H:\\Hackathon\\22-09-2026\\Hackathon-BU-2026";

export default defineConfig({
  root: PROJECT_ROOT,
  resolve: {
    alias: {
      "@": resolve(PROJECT_ROOT, "src")
    }
  },
  server: {
    fs: {
      allow: [PROJECT_ROOT]
    }
  }
});
