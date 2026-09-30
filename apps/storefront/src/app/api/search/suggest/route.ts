import { NextRequest, NextResponse } from "next/server"
import { PRODUCT_INDEX_NAME, searchClient } from "@lib/search-client"
import { MIN_QUERY, suggestionsFromHits } from "@modules/search/components/suggestions"

const HITS = 6

/**
 * GET /api/search/suggest?q=cab -> { suggestions: Suggestion[] }
 *
 * Header autocomplete goes through this same-origin route, which calls the
 * shared search client (POST /store/search) on the server. The browser then
 * never needs CORS access to the backend for search, and only titles,
 * handles, thumbnails and prices leave the server.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100)
  if (q.length < MIN_QUERY) return NextResponse.json({ suggestions: [] })
  try {
    const { results } = await searchClient.search([
      { indexName: PRODUCT_INDEX_NAME, params: { query: q, hitsPerPage: HITS, page: 0 } },
    ])
    return NextResponse.json(
      { suggestions: suggestionsFromHits(results[0]?.hits ?? []) },
      { headers: { "Cache-Control": "public, max-age=30" } }
    )
  } catch {
    return NextResponse.json({ suggestions: [], error: "unavailable" }, { status: 502 })
  }
}
