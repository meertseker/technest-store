import { revokeBody, revokeTradeApplication, tradeActions } from "../trade"

describe("revokeBody", () => {
  it("sends the reason trimmed, and nothing when there is none", () => {
    expect(revokeBody("  Account unused for a year.  ")).toEqual({ reason: "Account unused for a year." })
    expect(revokeBody("")).toEqual({})
    expect(revokeBody("   ")).toEqual({})
  })

  it("keeps the reason within what the server accepts (500 characters)", () => {
    expect(revokeBody("x".repeat(600))).toEqual({ reason: "x".repeat(500) })
  })
})

describe("revokeTradeApplication", () => {
  it("posts to the revoke route with the reason", async () => {
    const fetch = jest.fn().mockResolvedValue({ trade_application: { id: "tapp_1", status: "revoked", reason: "Closed down" } })
    const res = await revokeTradeApplication(fetch, "tapp_1", "Closed down")
    expect(fetch).toHaveBeenCalledWith("/admin/trade-applications/tapp_1/revoke", {
      method: "POST",
      body: { reason: "Closed down" },
    })
    expect(res.trade_application.status).toBe("revoked")
  })

  it("posts an empty body when no reason was given", async () => {
    const fetch = jest.fn().mockResolvedValue({ trade_application: { id: "tapp_1", status: "revoked", reason: null } })
    await revokeTradeApplication(fetch, "tapp_1", "")
    expect(fetch).toHaveBeenCalledWith("/admin/trade-applications/tapp_1/revoke", { method: "POST", body: {} })
  })

  it("passes the server's refusal through", async () => {
    const fetch = jest.fn().mockRejectedValue(Object.assign(new Error("Only an approved application can be closed"), { status: 400 }))
    await expect(revokeTradeApplication(fetch, "tapp_1", "")).rejects.toThrow(/approved/)
  })
})

describe("tradeActions", () => {
  it("offers approve/reject while waiting, close once approved, nothing after", () => {
    expect(tradeActions("pending")).toEqual(["approve", "reject"])
    expect(tradeActions("approved")).toEqual(["revoke"])
    expect(tradeActions("rejected")).toEqual([])
    expect(tradeActions("revoked")).toEqual([])
  })
})
