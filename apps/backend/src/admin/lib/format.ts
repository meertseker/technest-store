// Display helpers for the Tech Nest admin pages. The shop is in London, so
// dates are always shown in UK time whatever the device's clock says.

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

/**
 * Our own amounts (contracts, events, settings) are integer pence: 998 -> "£9.98".
 * Never use this for Medusa prices, which are already in pounds.
 */
export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "-"
  return money.format(pence / 100)
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "Tue 30 Sept, 11:40" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  return dateTime.format(new Date(iso))
}

/** "30 Sept 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-"
  return dateOnly.format(new Date(iso))
}

/** "just now", "25 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ""
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

/** The server's message, exactly as sent (the SDK puts it on `Error.message`). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
