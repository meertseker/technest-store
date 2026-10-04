import { assertPaymentProviderAllowed } from "../allowed-provider"

const refusal = (providerId: string, env: Record<string, string | undefined>) => {
  try {
    assertPaymentProviderAllowed(providerId, env)
    return null
  } catch (e) {
    return { type: (e as { type?: string }).type, message: (e as Error).message }
  }
}

describe("assertPaymentProviderAllowed", () => {
  const production = { NODE_ENV: "production" }

  it("in production allows Stripe", () => {
    expect(refusal("pp_stripe_stripe", production)).toBeNull()
  })

  it.each([["pp_system_default"], ["pp_recording_test"], ["pp_stripe-klarna_stripe"], [""]])(
    "in production refuses %j, whatever the region offers",
    (providerId) => {
      expect(refusal(providerId, production)).toEqual({
        type: "not_allowed",
        message: "This payment method isn't available.",
      })
    }
  )

  it.each([["development"], ["test"], [undefined]])(
    "outside production (NODE_ENV=%s) leaves the choice to the region",
    (nodeEnv) => {
      expect(refusal("pp_system_default", { NODE_ENV: nodeEnv })).toBeNull()
    }
  )
})
