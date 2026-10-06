import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { siteConfig } from "@lib/site-config"

const boom = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:9000"), { digest: "123" })

describe("error pages", { timeout: 30_000 }, () => {
  it("checkout has its own error page: retry by full page load, basket link and the shop's phone", async () => {
    const { default: CheckoutError } = await import("../(checkout)/error")
    const html = renderToStaticMarkup(createElement(CheckoutError, { error: boom, reset: () => {} }))
    expect(html).toContain("<h1")
    expect(html).toMatch(/<a[^>]*href="\/checkout"[^>]*>Try again<\/a>/)
    expect(html).toContain('href="/basket"')
    expect(html).toContain(`href="tel:${siteConfig.phone.e164}"`)
    // never the technical message
    expect(html).not.toContain("ECONNREFUSED")
  })

  it("the root has a last-resort error page that is a whole document", async () => {
    const { default: GlobalError } = await import("../global-error")
    const html = renderToStaticMarkup(createElement(GlobalError, { error: boom, reset: () => {} }))
    expect(html).toMatch(/^<html lang="en-GB"/)
    expect(html).toContain("<title>")
    expect(html).toContain("<h1")
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/)
    expect(html).toContain(`href="tel:${siteConfig.phone.e164}"`)
    expect(html).toContain("Tech Nest")
    expect(html).not.toContain("ECONNREFUSED")
  })
})
