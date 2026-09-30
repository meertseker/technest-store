import { buildImportPlan, DRAFT_SAFETY_WARNING, ExistingVariant, PlanContext, slugify } from "../plan"
import { readImportRows } from "../rows"

const chargers = {
  id: "pcat_chargers",
  handle: "chargers-cables",
  name: "Chargers & Cables",
  chain: { handle: "chargers-cables", parent_category: { handle: "phone-accessories" } },
}
const cases = {
  id: "pcat_cases",
  handle: "cases",
  name: "Cases",
  chain: { handle: "cases", parent_category: { handle: "phone-accessories" } },
}

const existingCable: ExistingVariant = {
  variant_id: "variant_1",
  product_id: "prod_1",
  product_title: "Old cable",
  product_handle: "old-cable",
  product_status: "published",
  variant_count: 1,
  manage_inventory: true,
  inventory_item_id: "iitem_1",
  level_exists: true,
  category_ids: ["pcat_chargers"],
  devices: [{ device_id: "dev_16", note: "Slim case only" }],
  safety_marking: "UKCA",
}

function ctx(over: Partial<PlanContext> = {}): PlanContext {
  return {
    variantsBySku: new Map([["TN-CABLE", existingCable]]),
    productIdByHandle: new Map([
      ["old-cable", "prod_1"],
      ["clear-case", "prod_2"],
    ]),
    categories: [chargers, cases],
    deviceIdBySlug: new Map([
      ["iphone-16", "dev_16"],
      ["iphone-16-pro", "dev_16p"],
    ]),
    ...over,
  }
}

const HEADER = "sku,title,handle,category,price_gbp,status,stock,device_slugs,safety_marking"
const plan = (lines: string[], c = ctx()) =>
  buildImportPlan(readImportRows([HEADER, ...lines].join("\n")), c)

describe("slugify", () => {
  it("makes URL handles", () => {
    expect(slugify("USB-C Cable 1m (Braided) & Plug")).toBe("usb-c-cable-1m-braided-and-plug")
  })
})

describe("buildImportPlan", () => {
  it("plans a new product with a handle from its title, published by default", () => {
    const { rows, summary } = plan(["TN-NEW,Clear Case,,cases,5.99,,10,iphone-16,"])
    expect(rows[0]).toMatchObject({
      line: 2,
      action: "create",
      status: "published",
      errors: [],
      resolved: {
        product_id: null,
        handle: "clear-case-tn-new", // "clear-case" is taken
        category_id: "pcat_cases",
        devices: [{ device_id: "dev_16", note: null }],
      },
    })
    expect(summary).toMatchObject({ rows: 1, create: 1, update: 0, error: 0 })
  })

  it("updates an existing SKU, keeps blank columns and existing device notes", () => {
    const { rows } = plan(["TN-CABLE,,,,4.5,,3,iphone-16;iphone-16-pro,"])
    expect(rows[0]).toMatchObject({
      action: "update",
      title: "Old cable",
      status: "published",
      resolved: {
        product_id: "prod_1",
        variant_id: "variant_1",
        handle: "old-cable",
        category_id: null,
        devices: [
          { device_id: "dev_16", note: "Slim case only" },
          { device_id: "dev_16p", note: null },
        ],
      },
    })
  })

  it("imports chargers without UKCA/CE as drafts with a warning", () => {
    const { rows, summary } = plan(["TN-PLUG,20W Plug,,chargers-cables,9.99,published,5,,"])
    expect(rows[0].action).toBe("create")
    expect(rows[0].status).toBe("draft")
    expect(rows[0].warnings).toEqual([DRAFT_SAFETY_WARNING])
    expect(summary.draft).toBe(1)

    const marked = plan(["TN-PLUG,20W Plug,,Chargers & Cables,9.99,,5,,CE"])
    expect(marked.rows[0]).toMatchObject({ status: "published", warnings: [] })
  })

  it("says so when a live charger is hidden because its marking is removed", () => {
    const { rows } = plan(["TN-CABLE,,,,,,,,none"])
    expect(rows[0].status).toBe("draft")
    expect(rows[0].warnings[0]).toMatch(/now hidden/)
  })

  it("rejects vapes, even as drafts", () => {
    const { rows } = plan(["TN-V1,Disposable Vape 600,,,4.99,draft,1,,"])
    expect(rows[0].action).toBe("error")
    expect(rows[0].errors[0]).toMatch(/vape/i)
  })

  it("lists every problem on the row", () => {
    const { rows, summary } = plan([
      "TN-A,,,widgets,,,,iphone-99,",
      "TN-A,Second,old-cable,,1,,,,",
    ])
    expect(rows[0].errors).toEqual([
      expect.stringMatching(/Title is empty/),
      expect.stringMatching(/Price is empty/),
      expect.stringMatching(/Category "widgets"/),
      expect.stringMatching(/Device "iphone-99"/),
    ])
    expect(rows[1].errors).toEqual([
      expect.stringMatching(/already on line 2/),
      expect.stringMatching(/Handle "old-cable" is already used/),
    ])
    expect(rows[1].status).toBeNull()
    expect(rows[1].resolved).toBeUndefined()
    expect(summary.error).toBe(2)
  })

  it("only updates price and stock on a SKU of a multi-option product", () => {
    const multi = { ...existingCable, variant_count: 3 }
    const { rows } = plan(
      ["TN-CABLE,New title,,cases,2.5,draft,4,,"],
      ctx({ variantsBySku: new Map([["TN-CABLE", multi]]) })
    )
    expect(rows[0]).toMatchObject({
      action: "update",
      status: "published",
      resolved: { variant_only: true, category_id: null, devices: null, attributes: {} },
    })
    expect(rows[0].warnings[0]).toMatch(/only its price and stock/)
  })

  it("warns when stock is given for an untracked product", () => {
    const untracked = { ...existingCable, manage_inventory: false }
    const { rows } = plan(
      ["TN-CABLE,,,,,,5,,"],
      ctx({ variantsBySku: new Map([["TN-CABLE", untracked]]) })
    )
    expect(rows[0].warnings[0]).toMatch(/Stock isn't tracked/)
  })

  it("passes file-level errors through", () => {
    const result = buildImportPlan(readImportRows("title\nA"), ctx())
    expect(result.file_errors).toHaveLength(1)
    expect(result.rows).toEqual([])
  })
})
