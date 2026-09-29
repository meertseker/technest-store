/** Tech Nest sells to the UK only; every region lookup uses this country. */
export const STORE_COUNTRY = (
  process.env.NEXT_PUBLIC_DEFAULT_REGION || "gb"
).toLowerCase()
export const STORE_CURRENCY = "gbp"
export const STORE_LOCALE = "en-GB"
