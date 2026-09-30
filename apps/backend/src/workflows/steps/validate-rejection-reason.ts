import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

/** A rejection must carry a non-blank reason (it is shown to the customer). */
export const validateRejectionReasonStep = createStep(
  "validate-rejection-reason",
  async ({ reason }: { reason?: string | null }) => {
    const trimmed = (reason ?? "").trim()
    if (!trimmed) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A reason is required to reject a trade application"
      )
    }
    return new StepResponse(trimmed)
  }
)
