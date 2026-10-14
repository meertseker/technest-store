import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { buildProductImportPlanStep } from "./steps/build-product-import-plan"
import { IMPORT_CHUNK_ROWS } from "../lib/product-import/chunks"

export type PlanProductImportInput = {
  csv: string
  /** The part about to be written (0-based), when the file is sent in parts. */
  part?: number
}

/**
 * The plan of an import that is about to be committed: read-only, and a
 * file-level problem fails it (400) so nothing is written. The route then
 * commits the plan in chunks with `technest-import-product-rows`.
 */
export const technestPlanProductImportWorkflow = createWorkflow(
  "technest-plan-product-import",
  function (input: PlanProductImportInput) {
    const planInput = transform({ input }, ({ input }) => ({
      csv: input.csv,
      fail_on_file_errors: true,
      detail_part:
        input.part === undefined ? undefined : { index: input.part, size: IMPORT_CHUNK_ROWS },
    }))
    const { plan, defaults } = buildProductImportPlanStep(planInput)
    return new WorkflowResponse({ plan, defaults })
  }
)
