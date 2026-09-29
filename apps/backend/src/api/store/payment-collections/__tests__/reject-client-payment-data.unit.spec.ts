import { rejectClientPaymentData } from "../reject-client-payment-data"

function run(body: unknown) {
  const next = jest.fn()
  let error: unknown
  try {
    rejectClientPaymentData({ body } as any, {} as any, next)
  } catch (e) {
    error = e
  }
  return { next, error: error as Error | undefined }
}

describe("rejectClientPaymentData", () => {
  it("lets a request with only provider_id through", () => {
    const { next, error } = run({ provider_id: "pp_stripe_stripe" })
    expect(error).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("lets an empty data object through", () => {
    const { next, error } = run({ provider_id: "pp_stripe_stripe", data: {} })
    expect(error).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it.each([
    [{ id: "pi_someone_else" }],
    [{ capture_method: "automatic" }],
    [{ payment_method_types: ["klarna"] }],
    ["string-data"],
  ])("rejects client-supplied data %j", (data) => {
    const { next, error } = run({ provider_id: "pp_stripe_stripe", data })
    expect(next).not.toHaveBeenCalled()
    expect(error?.message).toMatch(/data/)
    expect((error as any).type).toBe("invalid_data")
  })
})
