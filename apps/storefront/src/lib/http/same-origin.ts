/**
 * CSRF guard for plain HTML form POSTs to our own route handlers (server
 * actions have this built in; route handlers do not). Uses Fetch Metadata
 * when the browser sends it, else compares Origin with the Host the request
 * was made to. Requests with neither header (very old browsers, curl) pass:
 * only use this for low-risk, preference-type actions.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site")
  if (site) return site === "same-origin" || site === "none"
  const origin = headers.get("origin")
  if (!origin) return true
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  try {
    return !!host && new URL(origin).host === host.split(",")[0].trim()
  } catch {
    return false
  }
}
