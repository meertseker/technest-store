import { collectionDeadline } from "../../click-collect/deadline"
import { holdUntil } from "../collection-sources"

describe("holdUntil", () => {
  // The date in the email is the day the lifecycle job cancels at the end of.
  it("is the collection deadline as a London date", () => {
    const order = { created_at: "2026-10-02T09:00:00.000Z", ready_at: "2026-10-02T10:00:00.000Z" }

    // Ordered Friday 2 October 10:00 London: the card authorisation lapses Friday 9th in the morning.
    expect(holdUntil(order)).toBe("Thursday 8 October")
    const deadline = collectionDeadline({
      ordered_at: Date.parse(order.created_at),
      ready_at: Date.parse(order.ready_at),
    })
    expect(new Date(deadline).toISOString()).toBe("2026-10-08T22:59:59.999Z")
  })

  it("is null without usable dates", () => {
    expect(holdUntil({ created_at: undefined, ready_at: "2026-10-02T10:00:00.000Z" })).toBeNull()
    expect(holdUntil({ created_at: "2026-10-02T09:00:00.000Z", ready_at: "not a date" })).toBeNull()
  })
})
