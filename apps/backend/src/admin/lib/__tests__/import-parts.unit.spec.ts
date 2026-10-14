import type { ImportResponse } from "../../components/products/import-types"
import { importFailureMessage } from "../import-errors"
import { importInParts } from "../import-parts"

type Row = ImportResponse["plan"]["rows"][number]
const planRow = (line: number, action: string, extra: Partial<Row> = {}) =>
  ({ line, action, status: "published", errors: [], warnings: [], existing_draft_kept: false, ...extra }) as unknown as Row

/** The plan the server sends with a part: that part's rows only (two per part here). */
function partPlan(index: number): ImportResponse["plan"] {
  const rows =
    index === 1
      ? [planRow(202, "error", { status: null, errors: ["bad"] } as any), planRow(203, "update", { status: "draft", warnings: ["w"], existing_draft_kept: true } as any)]
      : [planRow(2 + index * 200, "create"), planRow(3 + index * 200, "update")]
  return { file_errors: [], file_warnings: ["ignored column x"], rows, summary: {} as any }
}

/** What the server answers for part `index` of a 450-row file (3 parts). */
function answer(index: number, created: number, updated: number, skipped = 0): ImportResponse {
  const from = 2 + index * 200
  const to = Math.min(from + 199, 451)
  return {
    plan: partPlan(index),
    created,
    updated,
    skipped,
    chunks: [{ rows: created + updated, lines: { from, to }, created, updated }],
    part: { index, count: 3, lines: { from, to } },
  }
}

class FetchError extends Error {
  constructor(message: string, public statusText?: string, public status?: number) {
    super(message)
  }
}

describe("importInParts", () => {
  it("sends the parts in order, reports progress and adds the answers up", async () => {
    const sent: number[] = []
    const progress: string[] = []
    const result = await importInParts(
      async (part) => {
        sent.push(part)
        return [answer(0, 150, 50), answer(1, 190, 0, 10), answer(2, 50, 0)][part]
      },
      (p) => progress.push(`${p.part}/${p.count ?? "?"}`)
    )
    expect(sent).toEqual([0, 1, 2])
    expect(progress).toEqual(["1/?", "2/3", "3/3"])
    expect(result).toEqual({
      // The parts' plans put together, in file order, with one summary.
      plan: {
        file_errors: [],
        file_warnings: ["ignored column x"],
        rows: [...partPlan(0).rows, ...partPlan(1).rows, ...partPlan(2).rows],
        summary: { rows: 6, create: 2, update: 3, error: 1, with_warnings: 1, draft: 1, existing_drafts_kept: 1 },
      },
      created: 390,
      updated: 50,
      skipped: 10,
      chunks: [
        answer(0, 150, 50).chunks[0],
        answer(1, 190, 0, 10).chunks[0],
        answer(2, 50, 0).chunks[0],
      ],
    })
  })

  it("stops at a failed part and says which lines were already imported", async () => {
    const problem = new FetchError("Charger X needs a safety marking.", "Bad Request", 400)
    const sent: number[] = []
    const error = await importInParts(async (part) => {
      sent.push(part)
      if (part === 2) throw problem
      return answer(part, 200, 0)
    }).catch((e) => e)
    expect(sent).toEqual([0, 1, 2])
    expect(error.message).toBe(
      "400 rows (lines 2 to 401) were imported before a problem stopped the import; the rows after them were not. " +
        "Charger X needs a safety marking. " +
        "Fix the file and import it again: rows already imported are updated, not added twice."
    )
    expect(error.status).toBe(400)
    expect(importFailureMessage(error)).toEqual({ title: "The import stopped part-way.", description: error.message })
  })

  it("passes a failure of the first part on unchanged: nothing was written", async () => {
    const problem = new FetchError("The file is empty.", "Bad Request", 400)
    await expect(importInParts(async () => Promise.reject(problem))).rejects.toBe(problem)
  })

  it("still says the import may be running when a later part was cut off", async () => {
    const error = await importInParts(async (part) => {
      if (part === 1) throw new FetchError("<html>timeout</html>", "Timeout", 524)
      return answer(part, 200, 0)
    }).catch((e) => e)
    expect(importFailureMessage(error).title).toBe(
      "The import may still be running. Check the product list before retrying."
    )
    const network = await importInParts(async (part) => {
      if (part === 1) throw new TypeError("Failed to fetch")
      return answer(part, 200, 0)
    }).catch((e) => e)
    expect(importFailureMessage(network).title).toMatch(/may still be running/)
  })
})
