import { collectionDeadline, endOfLondonDay } from "../click-collect/deadline"

const at = (iso: string) => Date.parse(iso)
const iso = (ms: number) => new Date(ms).toISOString()

describe("endOfLondonDay", () => {
  it("is the last millisecond of that day in London, in winter and in summer time", () => {
    expect(iso(endOfLondonDay(at("2026-01-15T10:00:00Z")))).toBe("2026-01-15T23:59:59.999Z")
    // BST: London is UTC+1, so the day ends at 22:59:59.999 UTC.
    expect(iso(endOfLondonDay(at("2026-07-15T10:00:00Z")))).toBe("2026-07-15T22:59:59.999Z")
    // 23:30 UTC in summer is already the next day in London.
    expect(iso(endOfLondonDay(at("2026-07-15T23:30:00Z")))).toBe("2026-07-16T22:59:59.999Z")
  })

  it("handles the day the clocks change", () => {
    // 25 October 2026: BST ends at 01:00 UTC; the day ends at 23:59:59.999 UTC.
    expect(iso(endOfLondonDay(at("2026-10-25T00:30:00Z")))).toBe("2026-10-25T23:59:59.999Z")
  })
})

describe("collectionDeadline", () => {
  // The card authorisation lasts 7 days from the order; the order must be collected (captured) before it lapses.
  it("is the end of the last whole London day before the authorisation runs out", () => {
    // Ordered Monday 5 Jan 10:00: the authorisation lapses Monday 12 Jan 10:00, so Sunday 11 Jan is the last day.
    const ordered = at("2026-01-05T10:00:00Z")
    expect(iso(collectionDeadline({ ordered_at: ordered, ready_at: at("2026-01-06T16:00:00Z") }))).toBe(
      "2026-01-11T23:59:59.999Z"
    )
  })

  it("never falls in the last hours of the authorisation", () => {
    // Ordered at 02:00: the end of day 6 would leave only 2 hours, so the deadline is a day earlier.
    const deadline = collectionDeadline({ ordered_at: at("2026-01-05T02:00:00Z"), ready_at: null })
    expect(iso(deadline)).toBe("2026-01-10T23:59:59.999Z")
  })

  // The day the clocks change is 23 or 25 hours long: "a day earlier" must still be the previous London day.
  it("steps back to the previous London day across the spring clock change", () => {
    // Ordered Mon 23 Mar 2026 05:30 GMT: the limit is just after midnight (BST) on Mon 30 Mar,
    // so the last whole day is Sunday 29 Mar (which ends at 22:59:59.999 UTC).
    expect(iso(collectionDeadline({ ordered_at: at("2026-03-23T05:30:00Z"), ready_at: null }))).toBe(
      "2026-03-29T22:59:59.999Z"
    )
  })

  it("never passes the authorisation limit on the 25-hour autumn day", () => {
    for (const ordered of ["2026-10-18T05:30:00Z", "2026-10-18T23:30:00Z", "2026-10-19T00:30:00Z"]) {
      const orderedAt = at(ordered)
      const deadline = collectionDeadline({ ordered_at: orderedAt, ready_at: null })
      expect(deadline).toBeLessThanOrEqual(orderedAt + 6.75 * 24 * 60 * 60 * 1000)
      expect(deadline).toBeGreaterThan(orderedAt + 5.7 * 24 * 60 * 60 * 1000)
    }
  })

  it("is the same whether or not the order was ever marked ready", () => {
    const ordered = at("2026-01-05T10:00:00Z")
    expect(collectionDeadline({ ordered_at: ordered, ready_at: null })).toBe(
      collectionDeadline({ ordered_at: ordered, ready_at: at("2026-01-05T12:00:00Z") })
    )
  })

  it("is 7 days after ready, end of that London day, when that comes first", () => {
    // Only possible if an authorisation lasted longer; the rule still holds.
    expect(
      iso(collectionDeadline({ ordered_at: at("2026-01-05T10:00:00Z"), ready_at: at("2025-12-30T09:30:00Z") }))
    ).toBe("2026-01-06T23:59:59.999Z")
  })
})
