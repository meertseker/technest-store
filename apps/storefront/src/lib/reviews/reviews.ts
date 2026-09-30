export type GoogleReview = {
  id: string
  author: string
  stars: number
  /** Verbatim from Google, emoji and line breaks included. Never edit. */
  text: string
  /** Google's relative date ("2 weeks ago") at `collected_at` */
  relative_date: string
}

/** Minimum length of a featured review, in characters (not UTF-16 units) */
export const MIN_REVIEW_CHARS = 60

const chars = (s: string) => Array.from(s.trim()).length

/**
 * Fixed rule (docs/specs/design.md 7.1): the newest reviews with at least
 * 60 characters of text, so rating-only reviews are never shown. `reviews`
 * must be newest first (the order of Google's export). Text is never edited
 * or shortened here.
 */
export function pickFeaturedReviews<T extends Pick<GoogleReview, "text">>(
  reviews: T[],
  count: number
): T[] {
  return reviews.filter((r) => chars(r.text) >= MIN_REVIEW_CHARS).slice(0, count)
}

/** "Anna Kmieciak (Anna K)" -> "Anna K." (privacy: first name + initial) */
export function displayAuthor(author: string) {
  const name = author.replace(/\(.*\)/, "").trim()
  const [first, ...rest] = name.split(/\s+/)
  const last = rest[rest.length - 1]
  return last ? `${first} ${Array.from(last)[0].toUpperCase()}.` : first
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }

/**
 * Google only gives relative dates, which go stale once copied. Turn one into
 * an approximate month, relative to the export date:
 * ("2 weeks ago", "2026-09-29") -> "September 2026". Unknown formats give null.
 */
export function approxReviewMonth(relative: string, collectedAt: string): string | null {
  const m = relative
    .trim()
    .toLowerCase()
    .match(/^(a|an|one|\d+)\s+(day|week|month|year)s?\s+ago$/)
  const base = new Date(`${collectedAt}T12:00:00Z`)
  if (!m || Number.isNaN(base.getTime())) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1
  const date = new Date(base)
  if (m[2] === "month") date.setUTCMonth(date.getUTCMonth() - n)
  else if (m[2] === "year") date.setUTCFullYear(date.getUTCFullYear() - n)
  else date.setUTCDate(date.getUTCDate() - n * UNIT_DAYS[m[2]])
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}
