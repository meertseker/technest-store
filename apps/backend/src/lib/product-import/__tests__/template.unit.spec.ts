import { IMPORT_TEMPLATE_CSV } from "../../../admin/routes/import/template"
import { parseCsv } from "../csv"
import { IMPORT_COLUMNS, readImportRows } from "../rows"

describe("the downloadable template", () => {
  it("has every import column and three clean example rows", () => {
    const header = IMPORT_TEMPLATE_CSV.split("\r\n")[0].split(",")
    expect(header).toEqual([...IMPORT_COLUMNS])

    const { rows, file_errors, file_warnings } = readImportRows(IMPORT_TEMPLATE_CSV)
    expect(file_errors).toEqual([])
    expect(file_warnings).toEqual([])
    expect(rows).toHaveLength(3)
    expect(rows.flatMap((r) => r.errors)).toEqual([])
    expect(rows[0].input.description).toBe("Slim, clear case with raised edges.")
    expect(rows[1].input.attributes.safety_marking).toBe("UKCA")
    expect(rows[2].input).toMatchObject({ price: 1, attributes: { is_addon_item: true } })
  })

  it("has no cell a spreadsheet would run as a formula", () => {
    const { rows } = parseCsv(IMPORT_TEMPLATE_CSV)
    for (const cell of rows.flat()) expect(cell).not.toMatch(/^[=+\-@\t\r]/)
  })
})
