import { completionRefusedBeforePayment } from "../payment-hold"

describe("completionRefusedBeforePayment", () => {
  it.each([
    ["the last unit was sold", { action: "reserve-inventory-step", error: { type: "not_allowed" } }],
    ["a basket rule or forged state (validate hook)", { action: "validate", error: { type: "invalid_data" } }],
    ["the delivery method is no longer valid", { action: "validate-shipping", error: { type: "invalid_data" } }],
  ])("is true when %s", (_label, failure) => {
    expect(completionRefusedBeforePayment(failure)).toBe(true)
  })

  // The payment module answers not_allowed for a session that isn't authorised (3DS still open, no card yet).
  // There is no hold to release, and cancelling would kill a payment the shopper is in the middle of.
  it("is false when the payment step itself refused, whatever the error type", () => {
    expect(
      completionRefusedBeforePayment({ action: "authorize-payment-session-step", error: { type: "not_allowed" } })
    ).toBe(false)
  })

  it.each([
    ["an unexpected error in a pre-payment step", { action: "reserve-inventory-step", error: { type: "unexpected_state" } }],
    ["a lock timeout (plain error)", { action: "acquire-lock-step", error: {} }],
    ["an unknown step", { action: "create-orders", error: { type: "invalid_data" } }],
    ["nothing", undefined],
  ])("is false for %s", (_label, failure) => {
    expect(completionRefusedBeforePayment(failure)).toBe(false)
  })
})
