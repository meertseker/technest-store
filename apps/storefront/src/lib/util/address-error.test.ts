import { describe, expect, it } from "vitest"
import { isTradeAccountEmailRefusal } from "./address-error"
import medusaError from "./medusa-error"

// What the Medusa JS SDK throws for a refused request (FetchError: message + status, no `response`).
const sdkError = (status: number, message: string) => Object.assign(new Error(message), { status })

const thrownBy = (error: unknown) => {
  try {
    medusaError(error)
  } catch (e) {
    return e
  }
}

describe("isTradeAccountEmailRefusal", () => {
  it("recognises the backend's refusal after it has passed through medusaError", () => {
    const refused = thrownBy(sdkError(401, "This email belongs to a trade account. Sign in to use it."))
    expect(isTradeAccountEmailRefusal(refused)).toBe(true)
  })

  it("is false for every other failure", () => {
    expect(isTradeAccountEmailRefusal(thrownBy(sdkError(400, "Postal code is required")))).toBe(false)
    expect(isTradeAccountEmailRefusal(new Error("No existing cart found"))).toBe(false)
    expect(isTradeAccountEmailRefusal("boom")).toBe(false)
    expect(isTradeAccountEmailRefusal(null)).toBe(false)
  })
})
