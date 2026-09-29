import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const offline = () => Promise.reject(new TypeError("fetch failed"))
vi.mock("@lib/data/regions", () => ({ getRegion: offline, listRegions: offline }))
vi.mock("@lib/data/collections", () => ({ listCollections: offline }))

describe("backend down", { timeout: 30_000 }, () => {
  it("the home page still renders instead of throwing", async () => {
    const { default: Home } = await import("../(main)/page")
    const html = renderToStaticMarkup(await Home())
    expect(html).toContain("show products right now")
  })

  it("the (main) error boundary keeps a friendly message and a retry button", async () => {
    const { default: ErrorPage } = await import("../(main)/error")
    const html = renderToStaticMarkup(
      createElement(ErrorPage, { error: new Error("boom"), reset: () => {} })
    )
    expect(html).toContain("Something went wrong")
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/)
    expect(html).not.toContain("boom")
  })
})
