import { describe, expect, it } from "vitest"
import { addressErrorMessage } from "./address-error"
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

describe("addressErrorMessage", () => {
  it("tells a shopper who typed a trade account's email to sign in", () => {
    const refused = thrownBy(sdkError(401, "This email belongs to a trade account. Sign in to use it."))

    expect(addressErrorMessage(refused)).toBe(
      "This email belongs to a trade account. Sign in to use this email, or enter a different one."
    )
  })

  it("keeps the message of any other error", () => {
    expect(addressErrorMessage(thrownBy(sdkError(400, "Postal code is required")))).toBe(
      "Error setting up the request: Postal code is required"
    )
    expect(addressErrorMessage(new Error("No existing cart found when setting addresses"))).toBe(
      "No existing cart found when setting addresses"
    )
    expect(addressErrorMessage("boom")).toBe("boom")
  })
})
