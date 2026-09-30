import { resolveEmail } from "../sources"
import { londonDay } from "../trade-sources"

type Rows = Record<string, Record<string, unknown>[]>

/** A container whose query.graph returns canned rows per entity (or throws for "throw"). */
function containerWith(rows: Rows) {
  const graph = jest.fn(async ({ entity, fields }: { entity: string; fields: string[] }) => {
    if (rows[entity] === undefined) throw new Error(`unknown entity ${entity}`)
    if (entity === "product" && fields.some((f) => f.startsWith("product_attributes")) && !rows.product.length) {
      throw new Error("product_attributes is not a relation")
    }
    return { data: rows[entity] }
  })
  return { graph, container: { resolve: () => ({ graph }) } as any }
}

const application = {
  id: "tapp_1",
  customer_id: "cus_1",
  company_name: "Acme Phones Ltd",
  vat_number: "GB123456789",
  companies_house_number: null,
  business_type: "limited_company",
  contact_name: "Jane Smith",
  contact_phone: "020 7946 0000",
  contact_email: "typed@elsewhere.test",
  status: "pending",
  reason: null,
}
const customer = { email: "jane@account.test", first_name: "Jane" }

beforeEach(() => {
  process.env.SHOP_NOTIFY_EMAIL = "shop@technest.test"
  process.env.ADMIN_URL = "https://admin.technest.co.uk/app/"
})

describe("trade application emails", () => {
  it("sends the applicant's copy to their ACCOUNT email, never the typed contact email", async () => {
    const { container } = containerWith({ trade_application: [application], customer: [customer] })
    const resolved = await resolveEmail(container, "trade-application-received", "tapp_1", "customer")
    expect(resolved).toEqual({
      to: "jane@account.test",
      data: { first_name: "Jane", company_name: "Acme Phones Ltd", reason: null },
    })
  })

  it("gives the shop the typed contact details and an admin link", async () => {
    const { container } = containerWith({ trade_application: [application] })
    const resolved = await resolveEmail(container, "shop-trade-application", "tapp_1", "shop")
    expect(resolved?.to).toBe("shop@technest.test")
    expect(resolved?.data).toMatchObject({
      company_name: "Acme Phones Ltd",
      business_type: "limited_company",
      vat_number: "GB123456789",
      companies_house_number: null,
      contact: { name: "Jane Smith", phone: "020 7946 0000", email: "typed@elsewhere.test" },
      admin_url: "https://admin.technest.co.uk/app/trade-applications/tapp_1",
    })
  })

  it("never crosses recipients: customer templates don't go to the shop, and vice versa", async () => {
    const { container } = containerWith({ trade_application: [application], customer: [customer] })
    expect(await resolveEmail(container, "trade-application-received", "tapp_1", "shop")).toBeNull()
    expect(await resolveEmail(container, "shop-trade-application", "tapp_1", "customer")).toBeNull()
  })

  it("only sends approved/rejected emails when the application has that status now", async () => {
    const pending = containerWith({ trade_application: [application], customer: [customer] })
    expect(await resolveEmail(pending.container, "trade-application-approved", "tapp_1", "customer")).toBeNull()
    expect(await resolveEmail(pending.container, "trade-application-rejected", "tapp_1", "customer")).toBeNull()

    const approved = containerWith({
      trade_application: [{ ...application, status: "approved" }],
      customer: [customer],
    })
    expect(await resolveEmail(approved.container, "trade-application-approved", "tapp_1", "customer")).toMatchObject({
      to: "jane@account.test",
    })
  })

  it("shows the stored rejection reason", async () => {
    const { container } = containerWith({
      trade_application: [{ ...application, status: "rejected", reason: "VAT number not found" }],
      customer: [customer],
    })
    const resolved = await resolveEmail(container, "trade-application-rejected", "tapp_1", "customer")
    expect(resolved?.data).toMatchObject({ reason: "VAT number not found" })
  })

  it("sends nothing for a missing application or a customer without an email", async () => {
    const missing = containerWith({ trade_application: [], customer: [customer] })
    expect(await resolveEmail(missing.container, "trade-application-received", "tapp_x", "customer")).toBeNull()
    expect(await resolveEmail(missing.container, "shop-trade-application", "tapp_x", "shop")).toBeNull()
    const noEmail = containerWith({ trade_application: [application], customer: [{ email: null }] })
    expect(await resolveEmail(noEmail.container, "trade-application-received", "tapp_1", "customer")).toBeNull()
  })
})

describe("repair booking email", () => {
  const booking = {
    id: "rep_1",
    name: "Sam Jones",
    phone: "07700 900123",
    email: "sam@example.com",
    device: "iPhone 13 mini",
    fault: "Cracked screen",
    preferred_time: "Weekday mornings",
    notes: "staff only",
  }

  it("goes to the shop only, with the booking details and a queue link", async () => {
    const { container } = containerWith({ repair_booking: [booking] })
    const resolved = await resolveEmail(container, "shop-repair-booking", "rep_1", "shop")
    expect(resolved).toEqual({
      to: "shop@technest.test",
      data: {
        name: "Sam Jones",
        phone: "07700 900123",
        email: "sam@example.com",
        device: "iPhone 13 mini",
        fault: "Cracked screen",
        preferred_time: "Weekday mornings",
        admin_url: "https://admin.technest.co.uk/app/repair-bookings/rep_1",
      },
    })
    expect(await resolveEmail(container, "shop-repair-booking", "rep_1", "customer")).toBeNull()
  })
})

describe("low-stock digest", () => {
  const variants = [
    {
      id: "variant_a",
      title: "1 m, black",
      sku: "CAB-1M",
      product: { id: "prod_a", title: "USB-C cable" },
      inventory_items: [{ inventory: { location_levels: [{ stocked_quantity: 2 }] } }],
    },
    {
      id: "variant_b",
      title: "iPhone 16",
      sku: null,
      product: { id: "prod_b", title: "Clear case" },
      inventory_items: [{ inventory: { location_levels: [{ stocked_quantity: 0 }] } }],
    },
  ]

  it("lists the variants emptiest first, with reorder levels when product attributes exist", async () => {
    const { container, graph } = containerWith({
      product_variant: variants,
      product: [
        { id: "prod_a", product_attributes: { reorder_level: 5 } },
        { id: "prod_b", product_attributes: null },
      ],
    })
    const resolved = await resolveEmail(container, "shop-low-stock-digest", "low_stock_x", "shop", [
      "variant_a",
      "variant_b",
      "variant_a",
    ])
    expect(resolved?.to).toBe("shop@technest.test")
    expect(resolved?.data.lines).toEqual([
      { product_title: "Clear case", variant_title: "iPhone 16", sku: null, stocked: 0, reorder_level: 3 },
      { product_title: "USB-C cable", variant_title: "1 m, black", sku: "CAB-1M", stocked: 2, reorder_level: 5 },
    ])
    expect(graph.mock.calls[0][0]).toMatchObject({ filters: { id: ["variant_a", "variant_b"] } })
  })

  it("still sends counts when the product attributes module isn't installed", async () => {
    const { container } = containerWith({ product_variant: variants, product: [] })
    const resolved = await resolveEmail(container, "shop-low-stock-digest", "low_stock_x", "shop", ["variant_a"])
    expect((resolved?.data.lines as any[]).map((l) => l.reorder_level)).toEqual([null, null])
  })

  it("falls back to the variant's metadata reorder level (the seed stores it there)", async () => {
    const withMeta = variants.map((v, i) => ({ ...v, metadata: { reorder_level: i ? "4" : "junk" } }))
    const absent = containerWith({ product_variant: withMeta, product: [] })
    const a = await resolveEmail(absent.container, "shop-low-stock-digest", "d", "shop", ["variant_a"])
    expect((a?.data.lines as any[]).map((l) => [l.sku, l.reorder_level])).toEqual([
      [null, 4],
      ["CAB-1M", null],
    ])
    const installed = containerWith({
      product_variant: withMeta,
      product: [{ id: "prod_a", product_attributes: null }],
    })
    const b = await resolveEmail(installed.container, "shop-low-stock-digest", "d", "shop", ["variant_a"])
    expect((b?.data.lines as any[]).map((l) => [l.sku, l.reorder_level])).toEqual([
      [null, 4],
      ["CAB-1M", 3],
    ])
  })

  it("sends nothing for an empty list, unknown variants or a customer recipient", async () => {
    const { container } = containerWith({ product_variant: [], product: [] })
    expect(await resolveEmail(container, "shop-low-stock-digest", "d", "shop", [])).toBeNull()
    expect(await resolveEmail(container, "shop-low-stock-digest", "d", "shop", ["variant_x"])).toBeNull()
    const full = containerWith({ product_variant: variants, product: [] })
    expect(await resolveEmail(full.container, "shop-low-stock-digest", "d", "customer", ["variant_a"])).toBeNull()
  })
})

describe("londonDay", () => {
  it("is the shop's calendar day", () => {
    expect(londonDay(new Date("2026-10-02T22:59:00Z"))).toBe("2026-10-02")
    // 23:30 UTC is already the next day in London (BST).
    expect(londonDay(new Date("2026-10-02T23:30:00Z"))).toBe("2026-10-03")
  })
})
