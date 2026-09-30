import { safeErrorMessage } from "../safe-error"

describe("safeErrorMessage", () => {
  it("masks email addresses", () => {
    expect(safeErrorMessage(new Error("550 <jane.doe+x@example.co.uk> rejected"))).toBe("550 <<email>> rejected")
  })

  it("keeps ordinary messages and handles non-errors", () => {
    expect(safeErrorMessage(new Error("Order order_1 not found"))).toBe("Order order_1 not found")
    expect(safeErrorMessage("boom")).toBe("boom")
  })
})
