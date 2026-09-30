import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import NotFoundContent from "."

describe("<NotFoundContent>", () => {
  it("has one h1, 16px text (no small classes) and 44px links to useful places", () => {
    const html = renderToStaticMarkup(createElement(NotFoundContent))
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Page not found")
    for (const href of ["/", "/search", "/devices", "/contact"]) expect(html).toContain(`href="${href}"`)
    expect(html).not.toMatch(/text-(xs|sm|small)/)
    expect(html.match(/min-h-1[12]/g)?.length).toBe(4)
  })
})
