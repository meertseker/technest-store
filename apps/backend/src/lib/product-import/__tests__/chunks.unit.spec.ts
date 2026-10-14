import { ImportPlan, PlanRow } from "../plan"
import { IMPORT_CHUNK_ROWS, importStoppedMessage, planPart, splitImportPlan } from "../chunks"

const row = (line: number, action: PlanRow["action"]): PlanRow => ({
  line,
  sku: `SKU-${line}`,
  title: `Row ${line}`,
  action,
  status: action === "error" ? null : "published",
  errors: action === "error" ? ["bad"] : [],
  warnings: [],
  existing_draft_kept: false,
  input: { sku: `SKU-${line}`, attributes: {} } as PlanRow["input"],
  ...(action === "error"
    ? {}
    : {
        resolved: {
          product_id: null,
          variant_id: null,
          handle: `row-${line}`,
          variant_only: false,
          category_id: null,
          devices: null,
          previous_devices: [],
          inventory_item_id: null,
          level_exists: false,
          manage_inventory: true,
          attributes: {},
          prices: null,
        },
      }),
})

const planOf = (rows: PlanRow[]): ImportPlan => ({
  file_errors: [],
  file_warnings: ["ignored column x"],
  rows,
  summary: {
    rows: rows.length,
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    error: rows.filter((r) => r.action === "error").length,
    with_warnings: 0,
    draft: 0,
    existing_drafts_kept: 0,
  },
})

describe("splitImportPlan", () => {
  it("cuts the importable rows into chunks of the given size, in file order, leaving error rows out", () => {
    const rows = Array.from({ length: 11 }, (_, i) => row(i + 2, i % 4 === 3 ? "error" : i % 2 ? "update" : "create"))
    const chunks = splitImportPlan(planOf(rows), 3)
    // 11 rows, 2 errors (lines 5 and 9) -> 9 importable rows -> 3, 3, 3.
    expect(chunks.map((c) => c.rows.map((r) => r.line))).toEqual([
      [2, 3, 4],
      [6, 7, 8],
      [10, 11, 12],
    ])
    for (const chunk of chunks) {
      expect(chunk.file_errors).toEqual([])
      expect(chunk.rows.every((r) => r.action !== "error" && r.resolved)).toBe(true)
      expect(chunk.summary.rows).toBe(3)
    }
    expect(chunks[0].summary).toMatchObject({ create: 2, update: 1, error: 0 })
  })

  it("makes a last, smaller chunk and no empty ones", () => {
    const chunks = splitImportPlan(planOf(Array.from({ length: 7 }, (_, i) => row(i + 2, "create"))), 3)
    expect(chunks.map((c) => c.rows.length)).toEqual([3, 3, 1])
    expect(splitImportPlan(planOf([row(2, "error")]), 3)).toEqual([])
    expect(splitImportPlan(planOf([]), 3)).toEqual([])
  })

  it("imports nothing from a file with file-level errors", () => {
    const plan = { ...planOf([row(2, "create")]), file_errors: ["no sku column"] }
    expect(splitImportPlan(plan, 3)).toEqual([])
  })

  it("uses chunks of 200 rows by default", () => {
    expect(IMPORT_CHUNK_ROWS).toBe(200)
    const chunks = splitImportPlan(planOf(Array.from({ length: 450 }, (_, i) => row(i + 2, "create"))))
    expect(chunks.map((c) => c.rows.length)).toEqual([200, 200, 50])
  })
})

describe("importStoppedMessage", () => {
  it("says what was written, what went wrong and that a re-import is safe", () => {
    const done = [
      { rows: 200, lines: { from: 2, to: 201 }, created: 150, updated: 50 },
      { rows: 200, lines: { from: 202, to: 401 }, created: 200, updated: 0 },
    ]
    expect(importStoppedMessage(done, "Charger X needs a safety marking.")).toBe(
      "400 rows (lines 2 to 401) were imported before a problem stopped the import; the rows after them were not. " +
        "Charger X needs a safety marking. " +
        "Fix the file and import it again: rows already imported are updated, not added twice."
    )
  })
})

describe("planPart", () => {
  // Parts are cut by position in the file (data rows), not by importable rows, so a
  // part means the same lines in every request even if earlier parts changed the shop.
  const rows = Array.from({ length: 11 }, (_, i) => row(i + 2, i % 4 === 3 ? "error" : "create"))

  it("takes the n-th window of data rows and keeps only the importable ones", () => {
    const first = planPart(planOf(rows), 0, 4)
    expect(first).toMatchObject({ index: 0, count: 3, lines: { from: 2, to: 5 }, skipped: 1 })
    expect(first.chunk!.rows.map((r) => r.line)).toEqual([2, 3, 4])
    // The part's own plan: every row of the window, problems included, with its own summary.
    expect(first.plan.rows.map((r) => r.line)).toEqual([2, 3, 4, 5])
    expect(first.plan.summary).toMatchObject({ rows: 4, create: 3, update: 0, error: 1 })
    expect(first.plan.file_warnings).toEqual(["ignored column x"])

    const last = planPart(planOf(rows), 2, 4)
    expect(last).toMatchObject({ index: 2, count: 3, lines: { from: 10, to: 12 }, skipped: 0 })
    expect(last.chunk!.rows.map((r) => r.line)).toEqual([10, 11, 12])
  })

  it("gives no chunk for a part with only problem rows", () => {
    const part = planPart(planOf([row(2, "error"), row(3, "create")]), 0, 1)
    expect(part).toMatchObject({ count: 2, lines: { from: 2, to: 2 }, skipped: 1, chunk: null })
  })

  it("imports nothing from a file with file-level errors", () => {
    const plan = { ...planOf([row(2, "create")]), file_errors: ["no sku column"] }
    expect(planPart(plan, 0, 4)).toMatchObject({ count: 0, chunk: null })
  })

  it("refuses a part past the end", () => {
    expect(() => planPart(planOf(rows), 3, 4)).toThrow("This file has 3 parts; there is no part 4.")
  })

  it("uses parts of 200 rows by default", () => {
    const big = planOf(Array.from({ length: 2000 }, (_, i) => row(i + 2, "create")))
    expect(planPart(big, 0).count).toBe(10)
    expect(planPart(big, 9)).toMatchObject({ lines: { from: 1802, to: 2001 } })
  })
})
