import { describe, expect, it } from "vitest"
import { dispatchDate, expectedDeliveryDate, formatDeliveryDate, orderDeliveryKind } from "./delivery-estimate"

// 2026-09-30 is a Wednesday; London is on BST (UTC+1)
const at = (iso: string) => new Date(iso)
const day = (d: Date | null) => (d ? formatDeliveryDate(d) : null)

describe("delivery estimate", () => {
  it("dispatches today before 3pm London time on a weekday", () => {
    expect(day(dispatchDate(at("2026-09-30T13:59:00Z")))).toBe("Wednesday 30 September")
    // 15:00 BST = 14:00 UTC
    expect(day(dispatchDate(at("2026-09-30T14:00:00Z")))).toBe("Thursday 1 October")
  })

  it("next-day: next working day, skipping the weekend", () => {
    expect(day(expectedDeliveryDate(at("2026-09-30T09:00:00Z"), "next-day"))).toBe("Thursday 1 October")
    expect(day(expectedDeliveryDate(at("2026-10-02T09:00:00Z"), "next-day"))).toBe("Monday 5 October")
    // Saturday order: dispatched Monday, arrives Tuesday
    expect(day(expectedDeliveryDate(at("2026-10-03T09:00:00Z"), "next-day"))).toBe("Tuesday 6 October")
  })

  it("standard: latest of 2-3 working days", () => {
    expect(day(expectedDeliveryDate(at("2026-09-30T09:00:00Z"), "standard"))).toBe("Monday 5 October")
  })

  it("collect has no delivery date", () => {
    expect(expectedDeliveryDate(at("2026-09-30T09:00:00Z"), "collect")).toBeNull()
  })

  it("reads the kind from the shipping method name", () => {
    expect(orderDeliveryKind({ shipping_methods: [{ name: "Click & Collect – Free in-store pickup" }] })).toBe("collect")
    expect(orderDeliveryKind({ shipping_methods: [{ name: "Next-day delivery" }] })).toBe("next-day")
    expect(orderDeliveryKind({ shipping_methods: [] })).toBe("standard")
  })
})
