import { describe, expect, it } from "vitest"
import { TRADE_STATUS_COPY } from "./format"
import type { TradeApplicationStatus } from "./types"

const STATUSES: TradeApplicationStatus[] = ["pending", "approved", "rejected", "revoked"]

describe("TRADE_STATUS_COPY", () => {
  it("has plain words for every status the backend can answer with", () => {
    for (const status of STATUSES) {
      const copy = TRADE_STATUS_COPY[status]
      expect(copy.label.length).toBeGreaterThan(0)
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.body.length).toBeGreaterThan(0)
    }
  })

  it("a closed (revoked) account says so, and that the customer may apply again", () => {
    const copy = TRADE_STATUS_COPY.revoked
    expect(copy.tone).toBe("warning")
    expect(copy.label).toBe("Closed")
    expect(copy.title).toMatch(/closed/i)
    expect(copy.body).toMatch(/apply again/i)
    expect(copy.body).not.toMatch(/revok/i) // the shopper's word is "closed"
  })
})
