import { getTechnestSettings } from "../get-settings"
import {
  buildFreeDeliveryPrices,
  defaultSettings,
  ExistingShippingPrice,
  resolveSettings,
  restoreShippingPrices,
  rulesToInput,
} from "../utils"

const containerWith = (rows: { key: string; value: number }[]) => {
  const listTechnestSettings = jest.fn().mockResolvedValue(rows)
  return {
    container: { resolve: jest.fn().mockReturnValue({ listTechnestSettings }) } as any,
    listTechnestSettings,
  }
}

describe("getTechnestSettings", () => {
  const env = process.env.KLARNA_MIN_BASKET_PENCE
  afterEach(() => {
    if (env === undefined) delete process.env.KLARNA_MIN_BASKET_PENCE
    else process.env.KLARNA_MIN_BASKET_PENCE = env
  })

  it("returns the defaults when nothing is saved", async () => {
    delete process.env.KLARNA_MIN_BASKET_PENCE
    const { container, listTechnestSettings } = containerWith([])
    await expect(getTechnestSettings(container)).resolves.toEqual({
      free_delivery_threshold_pence: 2000,
      klarna_min_basket_pence: 3000,
    })
    expect(container.resolve).toHaveBeenCalledWith("settings")
    expect(listTechnestSettings).toHaveBeenCalledWith(
      { key: ["free_delivery_threshold_pence", "klarna_min_basket_pence"] },
      expect.anything()
    )
  })

  it("saved values win over defaults and the env fallback", async () => {
    process.env.KLARNA_MIN_BASKET_PENCE = "4000"
    const { container } = containerWith([
      { key: "klarna_min_basket_pence", value: 2500 },
      { key: "free_delivery_threshold_pence", value: 0 },
    ])
    await expect(getTechnestSettings(container)).resolves.toEqual({
      free_delivery_threshold_pence: 0,
      klarna_min_basket_pence: 2500,
    })
  })

  it("uses KLARNA_MIN_BASKET_PENCE only as the fallback default", async () => {
    process.env.KLARNA_MIN_BASKET_PENCE = "4000"
    const { container } = containerWith([])
    expect((await getTechnestSettings(container)).klarna_min_basket_pence).toBe(4000)
  })
})

describe("defaultSettings / resolveSettings", () => {
  it.each(["abc", "-5", "12.5", "200000", ""])(
    "ignores an invalid KLARNA_MIN_BASKET_PENCE (%j)",
    (value) => {
      expect(defaultSettings({ KLARNA_MIN_BASKET_PENCE: value }).klarna_min_basket_pence).toBe(
        3000
      )
    }
  )

  it("ignores unknown keys and out-of-range rows", () => {
    expect(
      resolveSettings(
        [
          { key: "colour", value: 1 },
          { key: "free_delivery_threshold_pence", value: -1 },
          { key: "klarna_min_basket_pence", value: 100000 },
        ],
        {}
      )
    ).toEqual({ free_delivery_threshold_pence: 2000, klarna_min_basket_pence: 100000 })
  })
})

describe("free Standard delivery prices", () => {
  const base: ExistingShippingPrice[] = [
    { id: "price_cur", currency_code: "gbp", amount: 3.49, price_rules: [] },
    {
      id: "price_reg",
      currency_code: "gbp",
      amount: 3.49,
      price_rules: [{ attribute: "region_id", operator: "eq", value: "reg_1" }],
    },
  ]

  it("keeps the normal prices and adds a £0 twin per price, in major units", () => {
    expect(buildFreeDeliveryPrices(base, 2000)).toEqual([
      { id: "price_cur", currency_code: "gbp", amount: 3.49, rules: {} },
      { id: "price_reg", currency_code: "gbp", amount: 3.49, rules: { region_id: "reg_1" } },
      {
        currency_code: "gbp",
        amount: 0,
        rules: { item_total: [{ operator: "gte", value: 20 }] },
      },
      {
        currency_code: "gbp",
        amount: 0,
        rules: { region_id: "reg_1", item_total: [{ operator: "gte", value: 20 }] },
      },
    ])
  })

  it("replaces an earlier threshold instead of stacking", () => {
    const withOld: ExistingShippingPrice[] = [
      ...base,
      {
        id: "price_free",
        currency_code: "gbp",
        amount: 0,
        price_rules: [{ attribute: "item_total", operator: "gte", value: "20" }],
      },
    ]
    const next = buildFreeDeliveryPrices(withOld, 2599)
    expect(next).toHaveLength(4)
    expect(next.some((p) => "id" in p && p.id === "price_free")).toBe(false)
    expect(next[2]).toEqual({
      currency_code: "gbp",
      amount: 0,
      rules: { item_total: [{ operator: "gte", value: 25.99 }] },
    })
  })

  it("restores a snapshot: normal prices by id, conditional ones recreated with rules", () => {
    const snapshot: ExistingShippingPrice[] = [
      base[0],
      {
        id: "price_free",
        currency_code: "gbp",
        amount: 0,
        price_rules: [
          { attribute: "region_id", operator: "eq", value: "reg_1" },
          { attribute: "item_total", operator: "gte", value: "20" },
        ],
      },
    ]
    expect(restoreShippingPrices(snapshot)).toEqual([
      { id: "price_cur", currency_code: "gbp", amount: 3.49, rules: {} },
      {
        currency_code: "gbp",
        amount: 0,
        rules: { region_id: "reg_1", item_total: [{ operator: "gte", value: 20 }] },
      },
    ])
  })

  it("rulesToInput groups numeric operators per attribute", () => {
    expect(
      rulesToInput([
        { attribute: "item_total", operator: "gte", value: "10" },
        { attribute: "item_total", operator: "lt", value: "50" },
      ])
    ).toEqual({
      item_total: [
        { operator: "gte", value: 10 },
        { operator: "lt", value: 50 },
      ],
    })
  })
})
