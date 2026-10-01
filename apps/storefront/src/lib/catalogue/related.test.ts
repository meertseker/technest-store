import { describe, expect, it } from "vitest"
import { pickRelated } from "./related"
import { product } from "./test-fixtures"

const current = product({ id: "case", categories: ["cases"] })
const glass = product({ id: "glass", categories: ["protectors"] })
const charger = product({ id: "charger", categories: ["chargers"] })
const otherCase = product({ id: "case2", categories: ["cases"] })
const soldOut = product({ id: "gone", categories: ["chargers"], variants: [{ id: "v", qty: 0 }] })

const ids = (list: { id: string }[]) => list.map((p) => p.id)

describe("pickRelated ('Goes well with this')", () => {
  it("puts things from other parts of the range before more of the same", () => {
    expect(ids(pickRelated(current, [otherCase, glass, charger]))).toEqual(["glass", "charger", "case2"])
  })

  it("puts what fits the shopper's device first", () => {
    const fits = new Set(["charger", "case2"])
    expect(ids(pickRelated(current, [glass, otherCase, charger], { fitIds: fits }))).toEqual([
      "charger",
      "case2",
      "glass",
    ])
  })

  it("never offers the product itself or anything that can't be bought", () => {
    expect(ids(pickRelated(current, [current, soldOut, glass]))).toEqual(["glass"])
  })

  it("stops at four by default", () => {
    const many = Array.from({ length: 9 }, (_, i) => product({ id: `p${i}`, categories: ["x"] }))
    expect(pickRelated(current, many)).toHaveLength(4)
    expect(pickRelated(current, many, { limit: 2 })).toHaveLength(2)
  })
})
