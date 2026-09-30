import { NextResponse } from "next/server"

/**
 * 303 See Other to a same-origin path, for plain form POSTs. The Location is
 * relative on purpose: behind Caddy/Cloudflare the request URL can carry the
 * internal host, which an absolute redirect would leak.
 */
export const seeOther = (path: string) =>
  new NextResponse(null, {
    status: 303,
    headers: { location: path, "cache-control": "no-store" },
  })
