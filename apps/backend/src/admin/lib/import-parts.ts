import type { ImportResponse } from "../components/products/import-types"

export type ImportProgress = {
  /** The part being sent, counting from 1. */
  part: number
  /** Number of parts, known after the first answer. */
  count: number | null
}

/**
 * A later part failed after earlier parts were written. Keeps the status of
 * the failure, so a request the proxy cut off still reads as "may still be
 * running" (see import-errors.ts).
 */
export class ImportStoppedError extends Error {
  status?: number
  constructor(message: string, cause: unknown) {
    super(message)
    this.name = "ImportStoppedError"
    const status = (cause as { status?: unknown } | null)?.status
    if (typeof status === "number") this.status = status
  }
}

export const STOPPED_PART_WAY = "were imported before a problem stopped the import"

/**
 * Imports a file the way the server can take it: part 0 first (its answer says
 * how many parts there are), then the rest in order, one request each, so no
 * request runs into the proxy's time limit. Stops at the first failure.
 */
export async function importInParts(
  send: (part: number) => Promise<ImportResponse>,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResponse> {
  const answers: ImportResponse[] = []
  let count: number | null = null
  for (let part = 0; count === null || part < count; part++) {
    onProgress?.({ part: part + 1, count })
    let answer: ImportResponse
    try {
      answer = await send(part)
    } catch (e) {
      if (!answers.length) throw e
      const problem = e instanceof Error ? e.message : String(e)
      throw new ImportStoppedError(stoppedMessage(answers, problem), e)
    }
    answers.push(answer)
    count = answer.part?.count ?? 1
  }
  return {
    plan: mergePlans(answers.map((a) => a.plan)),
    created: answers.reduce((n, a) => n + a.created, 0),
    updated: answers.reduce((n, a) => n + a.updated, 0),
    skipped: answers.reduce((n, a) => n + a.skipped, 0),
    chunks: answers.flatMap((a) => a.chunks),
  }
}

/** Each part's answer carries that part's rows; put them back together as one plan. */
function mergePlans(plans: ImportResponse["plan"][]): ImportResponse["plan"] {
  const rows = plans.flatMap((p) => p.rows)
  return {
    file_errors: plans[0].file_errors,
    file_warnings: plans[0].file_warnings,
    rows,
    summary: {
      rows: rows.length,
      create: rows.filter((r) => r.action === "create").length,
      update: rows.filter((r) => r.action === "update").length,
      error: rows.filter((r) => r.action === "error").length,
      with_warnings: rows.filter((r) => r.warnings.length).length,
      draft: rows.filter((r) => r.status === "draft").length,
      existing_drafts_kept: rows.filter((r) => r.existing_draft_kept).length,
    },
  }
}

function stoppedMessage(done: ImportResponse[], problem: string): string {
  const rows = done.reduce((n, a) => n + a.created + a.updated, 0)
  const from = done[0].part?.lines.from
  const to = done[done.length - 1].part?.lines.to
  return (
    `${rows} rows (lines ${from} to ${to}) ${STOPPED_PART_WAY}; the rows after them were not. ` +
    `${problem.trim()} ` +
    "Fix the file and import it again: rows already imported are updated, not added twice."
  )
}
