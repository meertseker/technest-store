const DAY_MS = 24 * 60 * 60 * 1000

/** How long we promise to keep a ready order, counted to the end of that London day. */
export const HOLD_DAYS = 7
/**
 * A card authorisation lasts 7 days from the order (Stripe cancels it then).
 * The last moment we still count on capturing it leaves a few hours spare.
 */
export const AUTHORISATION_SAFE_MS = 6.75 * DAY_MS

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** London wall-clock time of an instant, expressed as if it were UTC. */
function londonWallClock(instant: number): number {
  const p = Object.fromEntries(londonParts.formatToParts(new Date(instant)).map((x) => [x.type, Number(x.value)]))
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/** The last millisecond of the London day that contains `instant`. */
export function endOfLondonDay(instant: number): number {
  const wall = new Date(londonWallClock(instant))
  const nextMidnightWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1)
  // Turn that wall-clock midnight back into an instant; a second pass settles the day the clocks change.
  let guess = nextMidnightWall - (londonWallClock(instant) - Math.floor(instant / 1000) * 1000)
  guess = nextMidnightWall - (londonWallClock(guess) - guess)
  return guess - 1
}

/**
 * The moment an uncollected Click & Collect order is cancelled, and the date
 * emails promise ("we'll keep it until ..."): the earlier of
 *  - 7 days after it was marked ready, end of that London day, and
 *  - the end of the last whole London day on which the card authorisation
 *    can still be captured.
 * Always the end of a London day, so the shop is never closed "early" on the
 * promised date. An order never marked ready has the authorisation limit only.
 */
export function collectionDeadline({
  ordered_at,
  ready_at,
}: {
  ordered_at: number
  ready_at: number | null
}): number {
  const limit = ordered_at + AUTHORISATION_SAFE_MS
  let authorisationEnd = endOfLondonDay(limit)
  if (authorisationEnd > limit) authorisationEnd = endOfLondonDay(limit - DAY_MS)
  if (ready_at === null) return authorisationEnd
  return Math.min(endOfLondonDay(ready_at + HOLD_DAYS * DAY_MS), authorisationEnd)
}
