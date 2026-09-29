import { NextRequest, NextResponse } from "next/server"
import { buildCheckoutCsp, createNonce, isCheckoutPath } from "@lib/checkout-csp"

/** Country prefixes the dtc-starter used; old links must still work. */
const LEGACY_COUNTRY_PREFIXES = new Set([
  "dk",
  "gb",
  "us",
  "de",
  "fr",
  "es",
  "it",
  "se",
])

export async function middleware(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl
  const [, first, ...rest] = pathname.split("/")

  if (first && LEGACY_COUNTRY_PREFIXES.has(first.toLowerCase())) {
    return NextResponse.redirect(`${origin}/${rest.join("/")}${search}`, 308)
  }

  const response = isCheckoutPath(pathname) ? checkoutResponse(request) : NextResponse.next()
  if (!request.cookies.get("_medusa_cache_id")) {
    response.cookies.set("_medusa_cache_id", crypto.randomUUID(), {
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      // only read server-side (lib/data/cookies.ts)
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    })
  }
  return response
}

/**
 * /checkout gets a per-request CSP (E2, ADR/TEAM_CHAT 2026-09-30). Setting it
 * on the request headers makes Next.js add the nonce to its own scripts.
 */
function checkoutResponse(request: NextRequest) {
  const nonce = createNonce()
  const csp = buildCheckoutCsp({
    isDev: process.env.NODE_ENV !== "production",
    nonce,
    backendUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
    imageHost: process.env.NEXT_PUBLIC_IMAGE_HOSTNAME,
  })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|.*\\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|txt|xml)).*)",
  ],
}
