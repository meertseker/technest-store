import { parseTab } from "../tabs"

const TABS = ["collect", "delivery", "repairs", "trade"] as const

describe("parseTab", () => {
  it("accepts an allowed tab, ignoring case and spaces", () => {
    expect(parseTab("delivery", TABS, "collect")).toBe("delivery")
    expect(parseTab(" Trade ", TABS, "collect")).toBe("trade")
  })

  it("falls back for unknown, empty and missing values", () => {
    expect(parseTab("orders", TABS, "collect")).toBe("collect")
    expect(parseTab("", TABS, "collect")).toBe("collect")
    expect(parseTab(null, TABS, "collect")).toBe("collect")
  })
})
