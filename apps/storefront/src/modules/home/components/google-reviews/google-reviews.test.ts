import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import data from "@/content/google-reviews.json"
import { pickFeaturedReviews } from "@/lib/reviews/reviews"
import { siteConfig } from "@/lib/site-config"
import GoogleReviews from "."

// React escapes these in text and attributes
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")

const html = renderToStaticMarkup(createElement(GoogleReviews))
const blockquotes: string[] = []
const BLOCKQUOTE = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g
for (let m = BLOCKQUOTE.exec(html); m; m = BLOCKQUOTE.exec(html)) blockquotes.push(m[1])

describe("<GoogleReviews>", () => {
  it("shows the 3 featured reviews with their text exactly as written", () => {
    const expected = pickFeaturedReviews(data.reviews, 3)
    expect(blockquotes).toEqual(expected.map((r) => esc(r.text)))
    // emoji and line breaks are the reviewer's, so they stay
    expect(blockquotes[0]).toContain("⭐️")
    expect(blockquotes[0]).toContain("\n")
  })

  it("attributes Google and links to the Maps profile", () => {
    expect(html).toContain("Reviews from Google")
    expect(html).toContain(`href="${esc(siteConfig.mapsUrl)}"`)
    expect(siteConfig.mapsUrl.startsWith("https://www.google.com/maps/")).toBe(true)
    expect(html).toContain("Read all reviews on Google")
    expect(html).toContain(`${siteConfig.rating.value.toFixed(1)} on Google · ${siteConfig.rating.count} reviews`)
  })

  it("shows first name + initial and an approximate month, never the full name", () => {
    expect(html).toContain("Anna K.")
    expect(html).not.toContain("Kmieciak")
    expect(html).toContain("September 2026")
  })

  it("adds no review or rating structured data (shop reviews are not product ratings)", () => {
    expect(html).not.toContain("application/ld+json")
    expect(html).not.toContain("AggregateRating")
  })
})
