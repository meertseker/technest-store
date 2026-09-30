import { demoDataEnabled } from "../index"

describe("demoDataEnabled", () => {
  it("is on only when SEED_DEMO_DATA is exactly \"true\"", () => {
    expect(demoDataEnabled({ SEED_DEMO_DATA: "true" })).toBe(true)
    expect(demoDataEnabled({})).toBe(false)
    expect(demoDataEnabled({ SEED_DEMO_DATA: "false" })).toBe(false)
    expect(demoDataEnabled({ SEED_DEMO_DATA: "1" })).toBe(false)
  })
})
