import { normalizeHeader, parseRowCells, readImportRows } from "../rows"

describe("normalizeHeader", () => {
  it("lowercases, drops notes in brackets and maps aliases", () => {
    expect(normalizeHeader(" Price (GBP) ")).toBe("price_gbp")
    expect(normalizeHeader("Device Slugs")).toBe("device_slugs")
    expect(normalizeHeader("Qty")).toBe("stock")
    expect(normalizeHeader("Safety-Marking")).toBe("safety_marking")
  })
})

describe("parseRowCells", () => {
  it("parses a full row into typed values", () => {
    const { input, errors } = parseRowCells({
      sku: " TN-001 ",
      title: "USB-C cable 1m",
      price_gbp: "£3.49",
      status: "Published",
      stock: "12",
      reorder_level: "4",
      device_slugs: "iphone-16; iphone-16-pro|IPHONE-16",
      connector_a: "USB-C",
      wattage: "20",
      cable_length_m: "1.5",
      platform: "ps5;PC",
      is_addon_item: "Yes",
      safety_marking: "uk ca",
      warranty_months: "12",
    })
    expect(errors).toEqual([])
    expect(input).toEqual({
      sku: "TN-001",
      title: "USB-C cable 1m",
      price: 3.49,
      status: "published",
      stock: 12,
      device_slugs: ["iphone-16", "iphone-16-pro"],
      attributes: {
        connector_a: "USB-C",
        wattage: 20,
        cable_length_m: 1.5,
        platform: ["ps5", "pc"],
        is_addon_item: true,
        safety_marking: "UKCA",
        warranty_months: 12,
        reorder_level: 4,
      },
    })
  })

  it("keeps prices in GBP major units (3.49 stays 3.49)", () => {
    expect(parseRowCells({ sku: "A", price_gbp: "3.49" }).input.price).toBe(3.49)
    expect(parseRowCells({ sku: "A", price_gbp: "1" }).input.price).toBe(1)
  })

  it("leaves blank cells out so an update keeps the stored value", () => {
    const { input } = parseRowCells({ sku: "A", title: "", stock: " ", safety_marking: "" })
    expect(input).toEqual({ sku: "A", attributes: {} })
  })

  it("reports readable errors for bad cells", () => {
    const { errors } = parseRowCells({
      sku: "",
      handle: "Bad Handle",
      price_gbp: "3,49",
      status: "live",
      stock: "-1",
      wattage: "20W",
      reorder_level: "2.5",
      platform: "ps6",
      is_addon_item: "maybe",
      safety_marking: "FCC",
    })
    expect(errors).toEqual([
      expect.stringMatching(/SKU is empty/),
      expect.stringMatching(/Handle "Bad Handle"/),
      expect.stringMatching(/Price "3,49"/),
      expect.stringMatching(/Status "live"/),
      expect.stringMatching(/Stock "-1"/),
      expect.stringMatching(/Wattage "20W"/),
      expect.stringMatching(/Reorder level "2.5"/),
      expect.stringMatching(/Platform "ps6"/),
      expect.stringMatching(/Add-on item "maybe"/),
      expect.stringMatching(/Safety marking "FCC"/),
    ])
  })

  it("refuses zero prices and more than two decimals", () => {
    expect(parseRowCells({ sku: "A", price_gbp: "0" }).errors).toHaveLength(1)
    expect(parseRowCells({ sku: "A", price_gbp: "3.499" }).errors).toHaveLength(1)
  })
})

describe("readImportRows", () => {
  it("returns rows with their file line numbers", () => {
    const { rows, file_errors } = readImportRows(
      "SKU,Title,Price (GBP)\nA,Cable,3.49\n\nB,Case,5\n"
    )
    expect(file_errors).toEqual([])
    expect(rows.map((r) => [r.line, r.input.sku, r.input.price])).toEqual([
      [2, "A", 3.49],
      [4, "B", 5],
    ])
  })

  it("warns about unknown columns", () => {
    expect(readImportRows("sku,colour\nA,red").file_warnings).toEqual([
      "These columns are ignored: colour.",
    ])
  })

  it("stops on file-level problems", () => {
    expect(readImportRows("").file_errors).toEqual(["The file is empty."])
    expect(readImportRows("title\nCable").file_errors[0]).toMatch(/no "sku" column/)
    expect(readImportRows("sku,title").file_errors[0]).toMatch(/no product rows/)
    expect(readImportRows("sku,sku\nA,B").file_errors[0]).toMatch(/appears twice/)
    expect(readImportRows('sku\n"A').file_errors[0]).toMatch(/never closed/)
  })
})

describe("safety limits", () => {
  it("refuses prices over the cap (pence typed as pounds)", () => {
    const { input, errors } = parseRowCells({ sku: "A", price_gbp: "34900" })
    expect(input.price).toBeUndefined()
    expect(errors[0]).toMatch(/over £5000/)
    expect(parseRowCells({ sku: "A", price_gbp: "5000" }).input.price).toBe(5000)
  })

  it("reads back cells the template escaped against CSV injection", () => {
    const { input } = parseRowCells({ sku: "A", title: "'=Clear case", description: "'Quoted" })
    expect(input.title).toBe("=Clear case")
    expect(input.description).toBe("'Quoted")
  })

  it("warns when the file isn't UTF-8", () => {
    const { file_warnings } = readImportRows("sku,title\nA,Caf� case")
    expect(file_warnings[0]).toMatch(/CSV UTF-8/)
  })
})
