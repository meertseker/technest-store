import fs from "fs"
import path from "path"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// The shop panel (apps/backend/panel, a Vite build) is served by this server at
// /panel, on the same origin as /admin, so it signs in with the same session
// cookie as Medusa's dashboard and needs no CORS. Caddy lets /panel* through on
// the admin host only.

export const PANEL_PATH = "/panel"

/**
 * `medusa develop` runs in apps/backend, where ./panel is the panel's source, so the
 * build under .medusa/server comes first; `medusa start` runs inside .medusa/server.
 */
export function panelRoots(cwd = process.cwd()): string[] {
  return [path.join(cwd, ".medusa", "server", "panel"), path.join(cwd, "panel")]
}

/** A built panel has index.html and an assets folder (the source folder has no assets). */
export function findPanelRoot(roots = panelRoots()): string | null {
  return roots.find((r) => fs.existsSync(path.join(r, "index.html")) && fs.existsSync(path.join(r, "assets"))) ?? null
}

/**
 * The file a request maps to: a built asset when the path names one inside the
 * root, otherwise index.html (the panel routes in the browser). Never a path
 * outside the root.
 */
export function resolvePanelFile(root: string, urlPath: string): { file: string; asset: boolean } {
  let rel = urlPath.split("?")[0].slice(PANEL_PATH.length).replace(/^\/+/, "")
  try {
    rel = decodeURIComponent(rel)
  } catch {
    rel = ""
  }
  const index = { file: path.join(root, "index.html"), asset: false }
  if (!rel || rel.includes("\0")) return index
  const file = path.resolve(root, rel)
  if (!file.startsWith(path.resolve(root) + path.sep)) return index
  try {
    if (fs.statSync(file).isFile()) return { file, asset: true }
  } catch {
    // Not a file: a panel route such as /panel/orders/123.
  }
  return index
}

// The panel loads only its own files and talks only to this origin. Images come
// from the media bucket and fal.ai previews (https), and blob: for the camera.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

export function servePanel(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") return next()
  const url = req.originalUrl || req.url
  if (url === PANEL_PATH) return res.redirect(301, `${PANEL_PATH}/`)
  const root = findPanelRoot()
  if (!root) {
    res.status(404).type("text/plain").send("The shop panel is not built on this server.")
    return
  }
  const { file, asset } = resolvePanelFile(root, url)
  res.setHeader("Content-Security-Policy", CSP)
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Referrer-Policy", "same-origin")
  // Built assets carry a content hash in their name; index.html must always be fresh.
  res.setHeader(
    "Cache-Control",
    asset && file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache"
  )
  res.sendFile(file)
}
