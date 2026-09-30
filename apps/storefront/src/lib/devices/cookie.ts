/** Name and rules of the device cookie (pure helpers; safe to import anywhere) */
export const DEVICE_COOKIE = "tn_device"
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** The device picker page */
export const PICKER_PATH = "/devices"

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Any origin works as the base: only whether the parsed URL keeps it matters
const BASE = "http://technest.invalid"

/** Only the server reads it (httpOnly); it is a preference, not a secret */
export const deviceCookieOptions = () => ({
  maxAge: DEVICE_COOKIE_MAX_AGE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
})

export const isDeviceSlug = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 80 && SLUG.test(v)

/** "/devices", "/devices/" and "/Devices" are all the picker itself */
export const isPickerPath = (pathname: string) =>
  pathname.replace(/\/+$/, "").toLowerCase() === PICKER_PATH

/**
 * Validates a post-choice destination (open-redirect guard). Only a
 * same-origin relative path is allowed, and it is returned exactly as given
 * (query and hash kept, no trailing slash added or removed), so the shopper
 * lands on the very page they left. The picker itself is refused, so
 * choosing a device never lands back on the picker.
 */
export function safeReturnPath(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v || v.length > 2048) return null
  // "/x" only: no scheme, no protocol-relative "//host"
  if (!v.startsWith("/") || v.startsWith("//")) return null
  // Browsers read "\" as "/" ("/\host"), and URL parsers drop tabs/newlines
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return null
  let url: URL
  try {
    url = new URL(v, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  if (isPickerPath(url.pathname)) return null
  return v
}

/**
 * The picker link for the page the shopper is on (pathname + query string).
 * Home and unsafe paths get the bare picker ("/" is the default destination
 * anyway). On the picker itself, the returnTo it already has is kept.
 */
export function pickerHref(pathname: string | null | undefined, search = ""): string {
  const qs = search.replace(/^\?/, "")
  const path = pathname || "/"
  const target = isPickerPath(path)
    ? safeReturnPath(new URLSearchParams(qs).get("returnTo"))
    : safeReturnPath(qs ? `${path}?${qs}` : path)
  if (!target || target === "/") return PICKER_PATH
  return `${PICKER_PATH}?${new URLSearchParams({ returnTo: target })}`
}
