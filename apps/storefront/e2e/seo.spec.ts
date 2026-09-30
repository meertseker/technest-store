import { expect, test } from "@playwright/test"

test.describe("seo routes", () => {
  test("robots.txt blocks private paths and links the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt")
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain("Disallow: /checkout")
    expect(body).toContain("Disallow: /account")
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/)
  })

  test("sitemap.xml lists the home, about and contact pages", async ({ request }) => {
    const res = await request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain("<urlset")
    expect(body).toMatch(/<loc>[^<]*\/about<\/loc>/)
    expect(body).toMatch(/<loc>[^<]*\/contact<\/loc>/)
    expect(body).not.toContain("/checkout")
  })
})
