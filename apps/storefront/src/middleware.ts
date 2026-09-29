import { NextRequest, NextResponse } from "next/server"

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

  const response = NextResponse.next()
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

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|.*\\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|txt|xml)).*)",
  ],
}
