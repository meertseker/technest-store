import { formatPence, penceToPoundsInput, poundsInputToPence } from "../pence"

describe("admin pence helpers", () => {
  it("formats pence as pounds", () => {
    expect(formatPence(2000)).toBe("£20.00")
    expect(formatPence(0)).toBe("£0.00")
    expect(formatPence(100000)).toBe("£1,000.00")
    expect(penceToPoundsInput(2599)).toBe("25.99")
  })

  it.each([
    ["20", 2000],
    ["20.5", 2050],
    ["20.05", 2005],
    ["£30.00", 3000],
    [" 1,000.00 ", 100000],
    ["0", 0],
    ["19.99", 1999],
  ])("parses %j as %i pence", (input, pence) => {
    expect(poundsInputToPence(input)).toBe(pence)
  })

  it.each(["", "abc", "-1", "20.555", "20.", ".5", "1e3", "£"])("rejects %j", (input) => {
    expect(poundsInputToPence(input)).toBeNull()
  })
})
