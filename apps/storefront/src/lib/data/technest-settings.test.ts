import { describe, expect, it, vi } from "vitest"

vi.mock("@lib/config", () => ({ sdk: { client: { fetch: vi.fn() } } }))

import { sdk } from "@lib/config"
import { formatPence, getTechnestSettings, parseSettings } from "./technest-settings"

describe("parseSettings", () => {
  it("accepts the contract shape", () => {
    expect(
      parseSettings({ settings: { free_delivery_threshold_pence: 2000, klarna_min_basket_pence: 3000 } })
    ).toEqual({ free_delivery_threshold_pence: 2000, klarna_min_basket_pence: 3000 })
  })

  it.each([
    null,
    {},
    { settings: {} },
    { settings: { free_delivery_threshold_pence: "2000", klarna_min_basket_pence: 3000 } },
    { settings: { free_delivery_threshold_pence: 20.5, klarna_min_basket_pence: 3000 } },
    { settings: { free_delivery_threshold_pence: -1, klarna_min_basket_pence: 3000 } },
  ])("rejects %j", (body) => {
    expect(parseSettings(body)).toBeNull()
  })
})

describe("getTechnestSettings", () => {
  it("returns null when the backend fails", async () => {
    vi.mocked(sdk.client.fetch).mockRejectedValueOnce(new Error("down"))
    await expect(getTechnestSettings()).resolves.toBeNull()
  })

  it("returns parsed settings", async () => {
    vi.mocked(sdk.client.fetch).mockResolvedValueOnce({
      settings: { free_delivery_threshold_pence: 2500, klarna_min_basket_pence: 3000 },
    })
    await expect(getTechnestSettings()).resolves.toEqual({
      free_delivery_threshold_pence: 2500,
      klarna_min_basket_pence: 3000,
    })
  })
})

describe("formatPence", () => {
  it("formats whole and fractional pounds", () => {
    expect(formatPence(2000)).toBe("£20")
    expect(formatPence(2050)).toBe("£20.50")
    expect(formatPence(99)).toBe("£0.99")
  })
})
