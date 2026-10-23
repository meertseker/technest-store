import react from "@vitejs/plugin-react"
import autoprefixer from "autoprefixer"
import path from "path"
import tailwindcss from "tailwindcss"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"

// The shop panel: a small React app for the shop owner, built into the
// backend's own output (.medusa/server/panel) and served at /panel by
// src/lib/panel/serve.ts. It reuses the screens in src/admin.
const here = path.dirname(fileURLToPath(import.meta.url))
const backend = process.env.PANEL_BACKEND_URL || "http://localhost:9000"

export default defineConfig({
  root: here,
  base: "/panel/",
  plugins: [react()],
  css: {
    postcss: { plugins: [tailwindcss({ config: path.join(here, "tailwind.config.cjs") }), autoprefixer()] },
  },
  build: {
    outDir: path.join(here, "..", ".medusa", "server", "panel"),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  // `pnpm panel:dev`: the panel on :5173 talking to a local backend.
  server: { proxy: { "/admin": backend, "/auth": backend } },
})
