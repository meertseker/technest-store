import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { PhotoModel } from "../modules/photo"
import { createProcessedPhotoStep } from "./steps/create-processed-photo"
import { StoreOriginalPhotoInput, storeOriginalPhotoStep } from "./steps/store-original-photo"

export type ProcessProductPhotoInput = StoreOriginalPhotoInput & { model?: PhotoModel }

/**
 * Original -> cut-out -> white-background 1:1 render. Does not touch any product;
 * see approve-product-photo for that. If rendering fails, the original is removed
 * again (only when this workflow uploaded it).
 */
export const processProductPhotoWorkflow = createWorkflow(
  "process-product-photo",
  function (input: ProcessProductPhotoInput) {
    const original = storeOriginalPhotoStep({ file_id: input.file_id, upload: input.upload })
    const stepInput = transform({ original, input }, ({ original, input }) => ({
      original,
      model: input.model,
    }))
    const result = createProcessedPhotoStep(stepInput)

    const response = transform({ original, result }, ({ original, result }) => ({
      original,
      ...result,
    }))
    return new WorkflowResponse(response)
  }
)
