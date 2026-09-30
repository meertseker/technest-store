import { describe, expect, it, vi } from "vitest"
import { isValidUkPostcode, normalisePostcode, postcodeExists } from "./postcode"

describe("UK postcode", () => {
  it.each(["SE16 3TU", "se163tu", " SW1A 1AA ", "M1 1AE", "B33 8TH", "CR2 6XH", "DN55 1PT", "W1A 0AX", "EC1A 1BB", "GIR 0AA"])(
    "accepts %s",
    (pc) => expect(isValidUkPostcode(pc)).toBe(true)
  )

  it.each(["", "SE16", "12345", "SE16 3T", "QQ1 1AA", "SE16 3TUU", "SE16-3TU", "not a postcode"])(
    "rejects %j",
    (pc) => expect(isValidUkPostcode(pc)).toBe(false)
  )

  it("normalises spacing and case", () => {
    expect(normalisePostcode(" se163tu")).toBe("SE16 3TU")
    expect(normalisePostcode("m11ae")).toBe("M1 1AE")
  })
})

describe("postcodeExists (postcodes.io)", () => {
  const reply = (body: unknown, ok = true) =>
    vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch

  it("is false only when postcodes.io says so", async () => {
    expect(await postcodeExists("SE16 3TU", reply({ result: true }))).toBe(true)
    expect(await postcodeExists("ZZ1 1ZZ", reply({ result: false }))).toBe(false)
  })

  it("never blocks the order on an outage", async () => {
    expect(await postcodeExists("SE16 3TU", reply({}, false))).toBe(true)
    const boom = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch
    expect(await postcodeExists("SE16 3TU", boom)).toBe(true)
  })
})
