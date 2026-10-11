import { isIdempotencyKey, newIdempotencyKey } from "../idempotency"

describe("newIdempotencyKey", () => {
  it("makes a UUID, a different one each time", () => {
    const a = newIdempotencyKey()
    const b = newIdempotencyKey()
    expect(isIdempotencyKey(a)).toBe(true)
    expect(isIdempotencyKey(b)).toBe(true)
    expect(a).not.toBe(b)
  })

  it("uses the platform generator when given one", () => {
    expect(newIdempotencyKey(() => "11111111-2222-4333-8444-555555555555")).toBe("11111111-2222-4333-8444-555555555555")
  })

  it("recognises only UUID-shaped keys", () => {
    expect(isIdempotencyKey("11111111-2222-4333-8444-555555555555")).toBe(true)
    expect(isIdempotencyKey("not-a-key")).toBe(false)
    expect(isIdempotencyKey(undefined)).toBe(false)
  })
})
