import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  loadQuickAddCatalogueStep,
  suggestProductFromPhotoStep,
} from "./steps/quick-add-steps"

export type AnalyzeProductPhotoInput = { file_id: string }

/**
 * Quick Add, step 1: a draft listing suggested by Claude from a product photo.
 * Read-only: writes nothing, the photo stays as uploaded.
 */
export const analyzeProductPhotoWorkflow = createWorkflow(
  "analyze-product-photo",
  function (input: AnalyzeProductPhotoInput) {
    const catalogue = loadQuickAddCatalogueStep()
    const stepInput = transform({ input, catalogue }, ({ input, catalogue }) => ({
      file_id: input.file_id,
      catalogue,
    }))
    const result = suggestProductFromPhotoStep(stepInput)
    return new WorkflowResponse(result)
  }
)
