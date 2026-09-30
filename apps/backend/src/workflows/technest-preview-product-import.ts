import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { buildProductImportPlanStep } from "./steps/build-product-import-plan"
import { ImportProductsWorkflowInput } from "./technest-import-products"

/**
 * A dry run of `technest-import-products`: what the import would do, row by
 * row. Writes nothing; file-level problems come back in `plan.file_errors`.
 */
export const technestPreviewProductImportWorkflow = createWorkflow(
  "technest-preview-product-import",
  function (input: ImportProductsWorkflowInput) {
    const { plan } = buildProductImportPlanStep(input)
    return new WorkflowResponse(plan)
  }
)
