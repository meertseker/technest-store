import { MedusaError } from "@medusajs/framework/utils"
import { ImportPlan, PlanRow } from "./plan"

/**
 * Rows written per workflow run, and per request when the admin page sends a
 * file in parts. A full 2000-row file takes two minutes or more, longer than
 * the proxy in front of the shop lets a request run; a part of 200 rows takes
 * about 15 s. Rows already written stay written if a later part fails, and a
 * re-import of the same file finishes the job (upsert by SKU).
 */
export const IMPORT_CHUNK_ROWS = 200

export type ImportChunkSummary = {
  rows: number
  /** First and last line of the file in this chunk. */
  lines: { from: number; to: number }
  created: number
  updated: number
}

/**
 * The importable rows of a plan (built once, against the database as it was)
 * in chunks of `size`, in file order. Each chunk is a plan of its own so the
 * commit workflow can run it unchanged. Pure.
 */
export function splitImportPlan(plan: ImportPlan, size = IMPORT_CHUNK_ROWS): ImportPlan[] {
  if (plan.file_errors.length) return []
  const ready = plan.rows.filter((r) => r.action !== "error" && r.resolved)
  const chunks: ImportPlan[] = []
  for (let i = 0; i < ready.length; i += size) {
    const rows = ready.slice(i, i + size)
    chunks.push({ file_errors: [], file_warnings: [], rows, summary: summarise(rows) })
  }
  return chunks
}

function summarise(rows: PlanRow[]): ImportPlan["summary"] {
  return {
    rows: rows.length,
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    error: rows.filter((r) => r.action === "error").length,
    with_warnings: rows.filter((r) => r.warnings.length).length,
    draft: rows.filter((r) => r.status === "draft").length,
    existing_drafts_kept: rows.filter((r) => r.existing_draft_kept).length,
  }
}

/** The error shown when a later chunk fails after earlier ones were written. */
export function importStoppedMessage(done: ImportChunkSummary[], problem: string): string {
  const rows = done.reduce((n, c) => n + c.rows, 0)
  const from = done[0].lines.from
  const to = done[done.length - 1].lines.to
  return (
    `${rows} rows (lines ${from} to ${to}) were imported before a problem stopped the import; ` +
    `the rows after them were not. ${problem.trim()} ` +
    "Fix the file and import it again: rows already imported are updated, not added twice."
  )
}

export type ImportPart = {
  index: number
  /** Number of parts in the file. */
  count: number
  /** First and last line of the file in this part (problem rows included). */
  lines: { from: number; to: number }
  /** Rows of this part skipped because of problems. */
  skipped: number
  /** The importable rows of this part, or null when there are none. */
  chunk: ImportPlan | null
  /** Every row of this part (problems included), with its own summary: what the answer shows. */
  plan: ImportPlan
}

/** The first data row (0-based) and the number of rows in part `index`. */
export function partWindow(index: number, size = IMPORT_CHUNK_ROWS) {
  return { start: index * size, end: (index + 1) * size }
}

/**
 * Part `index` of a file: the index-th window of `size` data rows, by position
 * in the file, so a part covers the same lines in every request even when the
 * plan is rebuilt after earlier parts were written. Pure.
 */
export function planPart(plan: ImportPlan, index: number, size = IMPORT_CHUNK_ROWS): ImportPart {
  if (plan.file_errors.length) {
    return { index, count: 0, lines: { from: 0, to: 0 }, skipped: 0, chunk: null, plan }
  }
  const count = Math.ceil(plan.rows.length / size)
  if (index >= count) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `This file has ${count} parts; there is no part ${index + 1}.`
    )
  }
  const { start, end } = partWindow(index, size)
  const window = plan.rows.slice(start, end)
  const ready = splitImportPlan({ ...plan, rows: window }, size)
  return {
    index,
    count,
    lines: { from: window[0].line, to: window[window.length - 1].line },
    skipped: window.length - (ready[0]?.rows.length ?? 0),
    chunk: ready[0] ?? null,
    plan: { ...plan, rows: window, summary: summarise(window) },
  }
}
