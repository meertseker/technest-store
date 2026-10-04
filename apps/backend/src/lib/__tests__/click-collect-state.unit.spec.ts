import { collectStateKeysIn, withoutCollectState } from "../click-collect"

describe("withoutCollectState", () => {
  it("drops every Click & Collect state key and keeps the rest", () => {
    expect(
      withoutCollectState({
        collection_code: "HACKED",
        ready_for_collection_at: "2026-01-01T00:00:00Z",
        collected_at: "2026-01-01T00:00:00Z",
        collection_reminder_sent_at: "2026-01-01T00:00:00Z",
        collection_expired_at: "2026-01-01T00:00:00Z",
        gift_note: "For Sam",
      })
    ).toEqual({ gift_note: "For Sam" })
  })

  it.each([[null], [undefined], ["text"], [["collected_at"]]])("leaves %j as it is", (value) => {
    expect(withoutCollectState(value)).toBe(value)
  })
})

describe("collectStateKeysIn", () => {
  it("names the state keys present, whatever their value", () => {
    expect(collectStateKeysIn({ collected_at: "", collection_code: null, gift_note: "x" })).toEqual([
      "collection_code",
      "collected_at",
    ])
  })

  it("finds none in metadata without state", () => {
    expect(collectStateKeysIn({ gift_note: "x" })).toEqual([])
    expect(collectStateKeysIn(null)).toEqual([])
  })
})
