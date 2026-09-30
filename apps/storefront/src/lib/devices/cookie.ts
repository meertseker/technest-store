/** Name and rules of the device cookie (pure helpers; safe to import anywhere) */
export const DEVICE_COOKIE = "tn_device"
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const isDeviceSlug = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 80 && SLUG.test(v)

/**
 * Only same-site relative paths are allowed as a post-choice destination
 * (open-redirect guard). The picker page itself is excluded so choosing a
 * device never lands back on the picker.
 */
export function safeReturnPath(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null
  if (/[\u0000-\u001f]/.test(v)) return null
  const path = v.split(/[?#]/)[0]
  if (path === "/devices") return null
  return v
}
