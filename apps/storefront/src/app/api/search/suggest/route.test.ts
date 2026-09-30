import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const search = vi.hoisted(() => vi.fn())
vi.mock("@lib/search-client", () => ({ PRODUCT_INDEX_NAME: "product", searchClient: { search } }))

import { GET } from "./route"

const get = (q: string) => GET(new NextRequest(`http://localhost/api/search/suggest?q=${encodeURIComponent(q)}`))

describe("GET /api/search/suggest", () => {
  beforeEach(() => search.mockReset())

  it("needs 2 characters before searching", async () => {
    const res = await get("c")
    expect(await res.json()).toEqual({ suggestions: [] })
    expect(search).not.toHaveBeenCalled()
  })

  it("returns up to 6 suggestions from the search index", async () => {
    search.mockResolvedValue({
      results: [{ hits: [{ objectID: "p1", title: "Cable", handle: "cable", thumbnail: null, min_price_gbp: 5.99, description: "x" }] }],
    })
    const res = await get("cable")
    expect(res.status).toBe(200)
    expect(search).toHaveBeenCalledWith([
      { indexName: "product", params: { query: "cable", hitsPerPage: 6, page: 0 } },
    ])
    expect(await res.json()).toEqual({
      suggestions: [{ id: "p1", title: "Cable", handle: "cable", thumbnail: null, price: 5.99 }],
    })
  })

  it("answers 502 without details when search fails", async () => {
    // A malformed body stands in for any failure inside the search call
    search.mockResolvedValue({ error: "secret-host unreachable" })
    const res = await get("cable")
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain("secret-host")
  })
})
