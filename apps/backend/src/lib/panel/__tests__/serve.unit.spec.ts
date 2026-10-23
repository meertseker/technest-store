import fs from "fs"
import os from "os"
import path from "path"
import { findPanelRoot, panelRoots, resolvePanelFile, servePanel } from "../serve"

let root: string

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "panel-"))
  fs.mkdirSync(path.join(root, "assets"))
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>")
  fs.writeFileSync(path.join(root, "assets", "app-abc123.js"), "1")
  fs.writeFileSync(path.join(root, "favicon.svg"), "<svg/>")
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe("resolvePanelFile", () => {
  it("serves a built asset", () => {
    expect(resolvePanelFile(root, "/panel/assets/app-abc123.js")).toEqual({
      file: path.join(root, "assets", "app-abc123.js"),
      asset: true,
    })
  })

  it("serves index.html for the panel's own routes and the bare path", () => {
    const index = { file: path.join(root, "index.html"), asset: false }
    expect(resolvePanelFile(root, "/panel/")).toEqual(index)
    expect(resolvePanelFile(root, "/panel/orders/order_123?tab=x")).toEqual(index)
    expect(resolvePanelFile(root, "/panel/assets")).toEqual(index)
  })

  it("never leaves the root, however the path is written", () => {
    const index = { file: path.join(root, "index.html"), asset: false }
    expect(resolvePanelFile(root, "/panel/../package.json")).toEqual(index)
    expect(resolvePanelFile(root, "/panel/%2e%2e/%2e%2e/etc/passwd")).toEqual(index)
    expect(resolvePanelFile(root, "/panel/..%5c..%5cwindows")).toEqual(index)
    expect(resolvePanelFile(root, "/panel/%E0%A4%A")).toEqual(index)
    expect(resolvePanelFile(root, "/panel/a%00b")).toEqual(index)
  })
})

describe("findPanelRoot", () => {
  it("finds the build in either place and nothing when it was not built", () => {
    expect(findPanelRoot([path.join(root, "nope"), root])).toBe(root)
    expect(findPanelRoot([path.join(root, "nope")])).toBeNull()
    expect(panelRoots("/srv")).toEqual([path.join("/srv", ".medusa", "server", "panel"), path.join("/srv", "panel")])
  })

  it("skips the panel's source folder, which has an index.html but no build", () => {
    const source = fs.mkdtempSync(path.join(os.tmpdir(), "panel-src-"))
    fs.writeFileSync(path.join(source, "index.html"), "<script src=./src/main.tsx>")
    try {
      expect(findPanelRoot([source, root])).toBe(root)
    } finally {
      fs.rmSync(source, { recursive: true, force: true })
    }
  })
})

describe("servePanel", () => {
  const res = () => {
    const r: any = { headers: {} as Record<string, string> }
    r.setHeader = (k: string, v: string) => (r.headers[k] = v)
    r.redirect = jest.fn()
    r.sendFile = jest.fn()
    r.status = jest.fn(() => r)
    r.type = jest.fn(() => r)
    r.send = jest.fn()
    return r
  }

  it("passes anything but GET and HEAD on", () => {
    const next = jest.fn()
    servePanel({ method: "POST", originalUrl: "/panel/" } as any, res(), next)
    expect(next).toHaveBeenCalled()
  })

  it("adds the trailing slash to the bare path", () => {
    const r = res()
    servePanel({ method: "GET", originalUrl: "/panel" } as any, r, jest.fn())
    expect(r.redirect).toHaveBeenCalledWith(301, "/panel/")
  })

  it("answers 404 in plain text when the panel was not built", () => {
    const cwd = jest.spyOn(process, "cwd").mockReturnValue(path.join(root, "empty"))
    const r = res()
    servePanel({ method: "GET", originalUrl: "/panel/" } as any, r, jest.fn())
    expect(r.status).toHaveBeenCalledWith(404)
    cwd.mockRestore()
  })

  it("sends index.html uncached with a strict policy, and hashed assets cached for a year", () => {
    const cwd = jest.spyOn(process, "cwd").mockReturnValue(path.dirname(root))
    fs.renameSync(root, path.join(path.dirname(root), "panel"))
    const built = path.join(path.dirname(root), "panel")
    try {
      const page = res()
      servePanel({ method: "GET", originalUrl: "/panel/orders" } as any, page, jest.fn())
      expect(page.sendFile).toHaveBeenCalledWith(path.join(built, "index.html"))
      expect(page.headers["Cache-Control"]).toBe("no-cache")
      expect(page.headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'")
      expect(page.headers["Content-Security-Policy"]).toContain("script-src 'self'")

      const asset = res()
      servePanel({ method: "GET", originalUrl: "/panel/assets/app-abc123.js" } as any, asset, jest.fn())
      expect(asset.headers["Cache-Control"]).toBe("public, max-age=31536000, immutable")

      const icon = res()
      servePanel({ method: "GET", originalUrl: "/panel/favicon.svg" } as any, icon, jest.fn())
      expect(icon.headers["Cache-Control"]).toBe("no-cache")
    } finally {
      fs.renameSync(built, root)
      cwd.mockRestore()
    }
  })
})
