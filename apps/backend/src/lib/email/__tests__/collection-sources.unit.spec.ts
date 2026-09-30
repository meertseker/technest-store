import { holdUntil } from "../collection-sources"

describe("holdUntil", () => {
  it("is 7 days after the order was marked ready, in shop time", () => {
    expect(holdUntil("2026-10-02T10:00:00.000Z")).toBe("Friday 9 October")
    // 23:30 UTC is already the next day in London (BST).
    expect(holdUntil("2026-10-02T23:30:00.000Z")).toBe("Saturday 10 October")
  })

  it("is null when the ready time is missing or invalid", () => {
    expect(holdUntil(undefined)).toBeNull()
    expect(holdUntil("not a date")).toBeNull()
  })
})
