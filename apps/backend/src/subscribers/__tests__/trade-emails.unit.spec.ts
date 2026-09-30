jest.mock("../../lib/email/run-email", () => ({ runEmail: jest.fn(async () => undefined) }))

import { runEmail } from "../../lib/email/run-email"
import lowStockDigestEmail, { config as lowStockConfig } from "../low-stock-digest-email"
import repairBookingEmail, { config as repairConfig } from "../repair-booking-email"
import tradeApplicationEmails, { config as tradeConfig } from "../trade-application-emails"

const run = runEmail as jest.Mock
const container = {} as any
const emit = (fn: any, name: string, data: unknown) => fn({ event: { name, data }, container })

beforeEach(() => run.mockClear())

describe("event names (docs/contracts/emails.md, trade.md, repairs.md)", () => {
  it("subscribes to the technest.* events", () => {
    expect(tradeConfig.event).toEqual([
      "technest.trade_application.created",
      "technest.trade_application.approved",
      "technest.trade_application.rejected",
    ])
    expect(repairConfig.event).toBe("technest.repair_booking.created")
    expect(lowStockConfig.event).toBe("technest.inventory.low_stock")
  })
})

describe("trade application emails", () => {
  it("created → the applicant's receipt and the shop alert, ids only", async () => {
    await emit(tradeApplicationEmails, "technest.trade_application.created", { id: "tapp_1", customer_id: "cus_1" })
    expect(run.mock.calls.map((c) => c[1])).toEqual([
      {
        template: "trade-application-received",
        recipient: "customer",
        resource_id: "tapp_1",
        resource_type: "trade_application",
        trigger_type: "technest.trade_application.created",
      },
      {
        template: "shop-trade-application",
        recipient: "shop",
        resource_id: "tapp_1",
        resource_type: "trade_application",
        trigger_type: "technest.trade_application.created",
      },
    ])
  })

  it("approved/rejected → one customer email; the payload's reason is not passed on", async () => {
    await emit(tradeApplicationEmails, "technest.trade_application.approved", { id: "tapp_1", customer_id: "cus_1" })
    await emit(tradeApplicationEmails, "technest.trade_application.rejected", {
      id: "tapp_2",
      customer_id: "cus_1",
      reason: "No VAT number",
    })
    expect(run.mock.calls.map((c) => [c[1].template, c[1].recipient, c[1].resource_id])).toEqual([
      ["trade-application-approved", "customer", "tapp_1"],
      ["trade-application-rejected", "customer", "tapp_2"],
    ])
    expect(JSON.stringify(run.mock.calls)).not.toContain("No VAT number")
  })

  it("ignores payloads without an id", async () => {
    await emit(tradeApplicationEmails, "technest.trade_application.created", {})
    await emit(tradeApplicationEmails, "technest.trade_application.created", { id: 42 })
    expect(run).not.toHaveBeenCalled()
  })
})

describe("repair booking email", () => {
  it("created → shop alert only", async () => {
    await emit(repairBookingEmail, "technest.repair_booking.created", { id: "rep_1" })
    expect(run.mock.calls.map((c) => c[1])).toEqual([
      {
        template: "shop-repair-booking",
        recipient: "shop",
        resource_id: "rep_1",
        resource_type: "repair_booking",
        trigger_type: "technest.repair_booking.created",
      },
    ])
  })
})

describe("low-stock digest email", () => {
  const item = (variant_id: unknown) => ({ variant_id, sku: "SKU", title: "Cable", stocked_quantity: 1, threshold: 3 })

  it("one digest per shop day, keyed by the London date, with de-duplicated variant ids only", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-05T07:00:00Z"))
    try {
      await emit(lowStockDigestEmail, "technest.inventory.low_stock", {
        items: [item("v1"), item("v2"), item("v1"), item(3), item(""), null, "v9"],
      })
    } finally {
      jest.useRealTimers()
    }
    expect(run.mock.calls.map((c) => c[1])).toEqual([
      {
        template: "shop-low-stock-digest",
        recipient: "shop",
        resource_id: "low_stock_2026-10-05",
        resource_type: "low_stock_digest",
        trigger_type: "technest.inventory.low_stock",
        ids: ["v1", "v2"],
      },
    ])
  })

  it("sends nothing for an empty or malformed list", async () => {
    await emit(lowStockDigestEmail, "technest.inventory.low_stock", { items: [] })
    await emit(lowStockDigestEmail, "technest.inventory.low_stock", { items: "v1" })
    await emit(lowStockDigestEmail, "technest.inventory.low_stock", { items: [{ sku: "X" }] })
    await emit(lowStockDigestEmail, "technest.inventory.low_stock", undefined)
    expect(run).not.toHaveBeenCalled()
  })
})
