import { renderToStaticMarkup } from "react-dom/server"
import { createElement, Fragment } from "react"
import { describe, expect, it } from "vitest"
import { LEGAL_CONTENT } from "@modules/legal/content"
import { ESSENTIAL_COOKIES } from "@modules/legal/content/cookies"
import { getLegalPage, LEGAL_PAGES } from "./pages"
import { legalDetails } from "./business"

const ctx = { freeDeliveryThreshold: "£20", klarnaMinimum: "£30" }

const render = (slug: keyof typeof LEGAL_CONTENT, c = ctx) => {
  const { summary, sections } = LEGAL_CONTENT[slug](c)
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      summary,
      ...sections.map((s) => createElement("section", { key: s.id }, s.heading, s.body))
    )
  )
}

describe("legal pages registry", () => {
  it("has the eight pages the brief asks for, with unique slugs", () => {
    const slugs = LEGAL_PAGES.map((p) => p.slug)
    expect(slugs).toEqual([
      "terms",
      "delivery",
      "returns",
      "privacy",
      "cookies",
      "accessibility",
      "weee",
      "repair-terms",
    ])
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("covers every slug the footer links to", () => {
    for (const slug of ["terms", "delivery", "returns", "privacy", "cookies", "accessibility"]) {
      expect(getLegalPage(slug)?.slug).toBe(slug)
    }
    expect(getLegalPage("nope")).toBeNull()
  })

  it.each(LEGAL_PAGES.map((p) => p.slug))("%s has content with unique kebab-case anchors", (slug) => {
    const { sections } = LEGAL_CONTENT[slug](ctx)
    expect(sections.length).toBeGreaterThan(2)
    const ids = sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it.each(LEGAL_PAGES.map((p) => p.slug))("%s renders without emojis", (slug) => {
    expect(render(slug)).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe("placeholders", () => {
  it("shows a visible placeholder while the legal name is unknown, never an invented one", () => {
    expect(legalDetails.legalName).toBeNull()
    expect(render("terms")).toContain("[legal business name: to be confirmed]")
    expect(render("terms")).toContain("[VAT number: to be confirmed]")
    expect(render("terms")).toContain("[company number, or sole trader: to be confirmed]")
  })

  it("never shows an email address while none is configured", () => {
    expect(legalDetails.email).toBeNull()
    for (const p of LEGAL_PAGES) expect(render(p.slug)).not.toMatch(/mailto:|@[a-z0-9-]+\.[a-z]/i)
  })

  it("uses the real shop address and phone", () => {
    const html = render("returns")
    expect(html).toContain("Unit 2A, Southwark Park Rd., London SE16 3TU")
    expect(html).toContain('href="tel:+447775669000"')
  })
})

describe("returns page", () => {
  it("contains the statutory model cancellation form wording", () => {
    const html = render("returns")
    expect(html).toContain("Model cancellation form")
    expect(html).toContain("(Complete and return this form only if you wish to cancel the contract.)")
    expect(html).toContain(
      "hereby give notice that I/We [*] cancel my/our [*] contract of sale of the following goods [*]/for the supply of the following service [*]"
    )
    expect(html).toContain("Signature of consumer(s) (only if this form is notified on paper)")
  })

  it("explains the 14-day right and in-store returns", () => {
    const html = render("returns")
    expect(html).toContain("14 days")
    expect(html).toContain("Returning an item to our shop")
  })
})

describe("settings-driven wording", () => {
  it("uses the admin free-delivery threshold and Klarna minimum", () => {
    expect(render("delivery")).toContain("Free when your basket is £20 or more.")
    expect(render("terms")).toContain("Klarna on baskets of £30 or more")
  })

  it("still reads correctly when the settings route is unavailable", () => {
    const none = { freeDeliveryThreshold: null, klarnaMinimum: null }
    expect(render("delivery", none)).toContain("Free above the amount shown in your basket.")
    expect(render("terms", none)).toContain("the minimum shown at checkout or more")
  })
})

describe("cookie policy", () => {
  it("lists every cookie the storefront code sets", () => {
    const names = ESSENTIAL_COOKIES.map((c) => c.name).join(" ")
    for (const n of [
      "_medusa_cart_id",
      "_medusa_jwt",
      "_medusa_cache_id",
      "_medusa_pending_customer",
      "_medusa_locale",
      "tn_device",
      "tn_consent",
    ]) {
      expect(names).toContain(n)
    }
  })
})
