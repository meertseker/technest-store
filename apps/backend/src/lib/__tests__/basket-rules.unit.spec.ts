import {
  ADDON_ONLY_MESSAGE,
  breaksAddonRule,
  evaluateBasketRules,
  isPickupOption,
} from "../basket-rules"

const addon = { is_addon: true }
const normal = { is_addon: false }
const pickup = { is_pickup: true }
const delivery = { is_pickup: false }

describe("evaluateBasketRules", () => {
  it("flags a basket of only add-ons", () => {
    expect(evaluateBasketRules([addon, addon])).toEqual({
      addon_only: true,
      delivery_allowed: false,
      message: ADDON_ONLY_MESSAGE,
    })
  })

  it("allows delivery with any non-add-on item", () => {
    expect(evaluateBasketRules([addon, normal])).toEqual({
      addon_only: false,
      delivery_allowed: true,
      message: null,
    })
  })

  it("treats an empty basket as not add-on only", () => {
    expect(evaluateBasketRules([]).addon_only).toBe(false)
  })
})

describe("breaksAddonRule", () => {
  it("breaks for add-ons only with delivery", () => {
    expect(breaksAddonRule([addon], [delivery])).toBe(true)
  })

  it("exempts Click & Collect", () => {
    expect(breaksAddonRule([addon], [pickup])).toBe(false)
  })

  it("is fine before shipping is chosen", () => {
    expect(breaksAddonRule([addon], [])).toBe(false)
  })

  it("is fine with a normal item and delivery", () => {
    expect(breaksAddonRule([addon, normal], [delivery])).toBe(false)
  })
})

describe("isPickupOption", () => {
  it("recognises the pickup fulfillment set or the click-collect type code", () => {
    expect(
      isPickupOption({ id: "so_1", service_zone: { fulfillment_set: { type: "pickup" } } })
    ).toBe(true)
    expect(isPickupOption({ id: "so_2", type: { code: "click-collect" } })).toBe(true)
    expect(
      isPickupOption({
        id: "so_3",
        type: { code: "standard" },
        service_zone: { fulfillment_set: { type: "shipping" } },
      })
    ).toBe(false)
  })
})
