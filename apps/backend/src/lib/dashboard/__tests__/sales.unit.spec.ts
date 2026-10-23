import { dailySales, londonDate, periodFor, startOfLondonDay, summarise, topProducts, type DashboardOrderRow } from "../sales"

const at = (iso: string) => new Date(iso).getTime()

describe("London days", () => {
  it("starts the day at London midnight in winter and in summer", () => {
    expect(new Date(startOfLondonDay(at("2026-01-15T15:00:00Z"))).toISOString()).toBe("2026-01-15T00:00:00.000Z")
    expect(new Date(startOfLondonDay(at("2026-07-15T15:00:00Z"))).toISOString()).toBe("2026-07-14T23:00:00.000Z")
    // 00:30 BST on 15 July is still 14 July in UTC, but the London day is the 15th.
    expect(londonDate(at("2026-07-14T23:30:00Z"))).toBe("2026-07-15")
  })

  it("handles the days the clocks change (23 and 25 hours)", () => {
    expect(new Date(startOfLondonDay(at("2026-03-29T12:00:00Z"))).toISOString()).toBe("2026-03-29T00:00:00.000Z")
    expect(new Date(startOfLondonDay(at("2026-03-30T12:00:00Z"))).toISOString()).toBe("2026-03-29T23:00:00.000Z")
    expect(new Date(startOfLondonDay(at("2026-10-25T12:00:00Z"))).toISOString()).toBe("2026-10-24T23:00:00.000Z")
    expect(new Date(startOfLondonDay(at("2026-10-26T12:00:00Z"))).toISOString()).toBe("2026-10-26T00:00:00.000Z")
  })

  it("makes a period of whole days with today last, and the same length before it", () => {
    const p = periodFor(7, at("2026-10-23T22:30:00Z"))
    expect(p.dates).toEqual(["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"])
    expect(new Date(p.from).toISOString()).toBe("2026-10-16T23:00:00.000Z")
    expect(new Date(p.previous_from).toISOString()).toBe("2026-10-09T23:00:00.000Z")
    expect(periodFor(1, at("2026-10-23T09:00:00Z")).dates).toEqual(["2026-10-23"])
  })
})

const order = (o: Partial<DashboardOrderRow>): DashboardOrderRow => ({ id: "o", created_at: "2026-10-23T10:00:00Z", status: "pending", ...o })

describe("summarise", () => {
  it("counts sales less refunds, skips cancelled orders, averages before refunds", () => {
    const s = summarise([
      order({ original_total: 10, total: 7.5, payment_collections: [{ payments: [{ refunds: [{ amount: 2.5 }] }] }] }),
      order({ original_total: "5.99" }),
      order({ original_total: 100, status: "canceled" }),
    ])
    expect(s).toEqual({ sales_pence: 1349, orders: 2, average_order_pence: 800, refunds_pence: 250 })
  })

  it("is all zero without orders", () => {
    expect(summarise([])).toEqual({ sales_pence: 0, orders: 0, average_order_pence: 0, refunds_pence: 0 })
  })
})

describe("dailySales", () => {
  it("puts each order on its London day and keeps empty days", () => {
    const rows = dailySales(
      [
        order({ created_at: "2026-10-22T23:30:00Z", original_total: 3 }), // 00:30 BST on the 23rd
        order({ created_at: "2026-10-23T12:00:00Z", original_total: 2 }),
        order({ created_at: "2026-10-01T12:00:00Z", original_total: 50 }), // outside the period
      ],
      ["2026-10-22", "2026-10-23"]
    )
    expect(rows).toEqual([
      { date: "2026-10-22", sales_pence: 0, orders: 0 },
      { date: "2026-10-23", sales_pence: 500, orders: 2 },
    ])
  })
})

describe("topProducts", () => {
  it("ranks by units, then money, across orders", () => {
    const top = topProducts([
      order({ items: [{ product_id: "a", product_title: "Cable", quantity: 2, total: 10 }, { product_id: "b", product_title: "Case", quantity: 1, total: 15 }] }),
      order({ items: [{ product_id: "b", product_title: "Case", quantity: 1, total: 15 }, { product_id: "c", title: "Charger", quantity: 2, total: 40 }] }),
      order({ status: "canceled", items: [{ product_id: "d", product_title: "Never", quantity: 9, total: 9 }] }),
    ])
    expect(top).toEqual([
      { title: "Charger", quantity: 2, sales_pence: 4000 },
      { title: "Case", quantity: 2, sales_pence: 3000 },
      { title: "Cable", quantity: 2, sales_pence: 1000 },
    ])
  })
})
