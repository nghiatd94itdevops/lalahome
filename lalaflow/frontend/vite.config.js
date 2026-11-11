import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

// The Mimi mascot is imported straight from the brand kit at the repository's LaLaHome folder, outside this app.
const BRAND_KIT = fileURLToPath(new URL("../../LaLaHome", import.meta.url));

// Built into web/lalaflow so the FastAPI static server on :8000 serves it next to the LalaHome cover.
export default defineConfig({
  plugins: [react()],
  // Absolute: with real URLs (/lalaflow/san-pham/85) a relative "./assets" would resolve under /san-pham/.
  base: "/lalaflow/",
  build: { outDir: "../../web/lalaflow", emptyOutDir: true },
  server: { port: 5173, fs: { allow: [searchForWorkspaceRoot(process.cwd()), BRAND_KIT] } },
});
