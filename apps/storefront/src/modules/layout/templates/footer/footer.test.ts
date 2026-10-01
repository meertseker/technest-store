import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const listCategories = vi.fn()
vi.mock("@lib/data/categories", () => ({ listCategories: (...a: unknown[]) => listCategories(...a) }))

import Footer from "."

const cats = [
  { id: "au", name: "Audio", handle: "audio", parent_category_id: null, rank: 1 },
  { id: "pa", name: "Phone Accessories", handle: "phone-accessories", parent_category_id: null, rank: 0 },
  { id: "cs", name: "Cases", handle: "cases", parent_category_id: "pa", rank: 0 },
]

const APP = join(__dirname, "../../../../app")

/** true when a page.tsx serves this path (route groups ignored, [x] and [...x] matched) */
function hasPage(path: string, dir = APP, segments = path.split("/").filter(Boolean)): boolean {
  if (!segments.length) return existsSync(join(dir, "page.tsx"))
  const [head, ...rest] = segments
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .some((e) => {
      const next = join(dir, e.name)
      if (/^\(.*\)$/.test(e.name)) return hasPage(path, next, segments)
      if (/^\[\.\.\..*\]$/.test(e.name)) return existsSync(join(next, "page.tsx"))
      if (e.name === head || /^\[.*\]$/.test(e.name)) return hasPage(path, next, rest)
      return false
    })
}

const render = async () => renderToStaticMarkup(await Footer())
const internalLinks = (html: string) =>
  Array.from(html.matchAll(/href="(\/[^"#?]*)"/g), (m) => m[1])

afterEach(() => listCategories.mockReset())

describe("<Footer>", () => {
  it("every internal link goes to a page that exists", async () => {
    listCategories.mockResolvedValue(cats)
    const links = internalLinks(await render())
    expect(links.length).toBeGreaterThan(10)
    expect(links.filter((href) => !hasPage(href))).toEqual([])
  })

  it("lists the shop's top-level categories in rank order", async () => {
    listCategories.mockResolvedValue(cats)
    const html = await render()
    expect(html.indexOf('href="/c/phone-accessories"')).toBeGreaterThan(-1)
    expect(html.indexOf('href="/c/phone-accessories"')).toBeLessThan(html.indexOf('href="/c/audio"'))
    expect(html).not.toContain('href="/c/phone-accessories/cases"')
  })

  it("puts delivery, returns and Click & Collect under Help", async () => {
    listCategories.mockResolvedValue(cats)
    const help = (await render()).split('id="footer-help"')[1].split("</section>")[0]
    expect(internalLinks(help)).toEqual([
      "/legal/delivery",
      "/legal/returns",
      "/click-and-collect",
      "/contact",
      "/legal/accessibility",
    ])
  })

  it("says how you can pay, in words (no logo is the only cue)", async () => {
    listCategories.mockResolvedValue(cats)
    const html = await render()
    const list = html.split('aria-label="Ways to pay"')[1].split("</ul>")[0]
    expect(Array.from(list.matchAll(/<li[^>]*>([^<]+)<\/li>/g), (m) => m[1])).toEqual([
      "Visa",
      "Mastercard",
      "Apple Pay",
      "Google Pay",
      "Klarna",
    ])
  })

  it("still renders when the backend is down", async () => {
    listCategories.mockRejectedValue(new TypeError("fetch failed"))
    expect(await render()).toContain("Visit us")
  })
})
