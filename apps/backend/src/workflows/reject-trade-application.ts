import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { TRADE_EVENTS } from "../modules/trade/constants"
import {
  retrievePendingTradeApplicationStep,
  updateTradeApplicationStatusStep,
} from "./steps/trade-application-steps"
import { validateRejectionReasonStep } from "./steps/validate-rejection-reason"

export const rejectTradeApplicationWorkflow = createWorkflow(
  "reject-trade-application",
  function (input: { id: string; reason: string }) {
    const reason = validateRejectionReasonStep(input)
    const application = retrievePendingTradeApplicationStep(input)
    const update = transform({ input, reason }, ({ input, reason }) => ({
      id: input.id,
      status: "rejected" as const,
      reason,
    }))
    const updated = updateTradeApplicationStatusStep(update)
    const event = transform({ application, reason }, ({ application, reason }) => ({
      eventName: TRADE_EVENTS.REJECTED,
      data: { id: application.id, customer_id: application.customer_id, reason },
    }))
    emitEventStep(event)
    return new WorkflowResponse(updated)
  }
)
