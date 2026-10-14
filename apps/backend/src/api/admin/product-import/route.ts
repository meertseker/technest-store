import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  IMPORT_CHUNK_ROWS,
  ImportChunkSummary,
  importStoppedMessage,
  planPart,
  splitImportPlan,
} from "../../../lib/product-import/chunks"
import { technestPlanProductImportWorkflow } from "../../../workflows/technest-plan-product-import"
import {
  ImportProductsResult,
  technestImportProductRowsWorkflow,
} from "../../../workflows/technest-import-products"
import { AdminProductImportCommit } from "./middlewares"

/**
 * POST /admin/product-import: imports the CSV (upsert by SKU). The plan is
 * built here, never taken from the client. Rows with errors are skipped and
 * reported; a file-level error imports nothing (400 invalid_data).
 *
 * With `part` (what the admin page sends): only that part of the file
 * (IMPORT_CHUNK_ROWS data rows) is written, in one workflow run, so every
 * request stays well inside the proxy's time limit. The page sends part 0,
 * learns the number of parts from the answer, and sends the rest in order.
 *
 * Without `part` (scripts): the whole file in one request, written in chunks
 * of IMPORT_CHUNK_ROWS, each its own workflow run with its own rollback; a
 * 2000-row file takes minutes this way.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminProductImportCommit>,
  res: MedusaResponse
) {
  const {
    result: { plan, defaults },
  } = await technestPlanProductImportWorkflow(req.scope).run({
    input: { csv: req.validatedBody.csv, part: req.validatedBody.part },
  })

  if (req.validatedBody.part !== undefined) {
    const part = planPart(plan, req.validatedBody.part)
    const chunks: ImportChunkSummary[] = []
    if (part.chunk) {
      const { result } = await technestImportProductRowsWorkflow(req.scope).run({
        input: { plan: part.chunk, defaults },
      })
      const rows = part.chunk.rows
      chunks.push({
        rows: rows.length,
        lines: { from: rows[0].line, to: rows[rows.length - 1].line },
        created: result.created,
        updated: result.updated,
      })
    }
    // Only this part's rows: the plan's other rows were built from light data
    // (see buildProductImportPlanStep) and are not shown or written.
    const body: ImportProductsResult = {
      plan: part.plan,
      created: chunks[0]?.created ?? 0,
      updated: chunks[0]?.updated ?? 0,
      skipped: part.skipped,
      chunks,
      part: { index: part.index, count: part.count, lines: part.lines },
    }
    res.json(body)
    return
  }

  const chunks: ImportChunkSummary[] = []
  for (const chunk of splitImportPlan(plan, IMPORT_CHUNK_ROWS)) {
    try {
      const { result } = await technestImportProductRowsWorkflow(req.scope).run({
        input: { plan: chunk, defaults },
      })
      chunks.push({
        rows: chunk.rows.length,
        lines: { from: chunk.rows[0].line, to: chunk.rows[chunk.rows.length - 1].line },
        created: result.created,
        updated: result.updated,
      })
    } catch (e) {
      if (!chunks.length) {
        throw e
      }
      // Earlier chunks are committed and stay: say so, with the original problem.
      const type = e instanceof MedusaError ? e.type : MedusaError.Types.UNEXPECTED_STATE
      const problem = e instanceof Error ? e.message : String(e)
      throw new MedusaError(type, importStoppedMessage(chunks, problem))
    }
  }

  const body: ImportProductsResult = {
    plan,
    created: chunks.reduce((n, c) => n + c.created, 0),
    updated: chunks.reduce((n, c) => n + c.updated, 0),
    skipped: plan.rows.length - chunks.reduce((n, c) => n + c.rows, 0),
    chunks,
  }
  res.json(body)
}
