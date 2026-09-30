import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { TRADE_EVENTS } from "../modules/trade/constants"
import {
  retrievePendingTradeApplicationStep,
  updateTradeApplicationStatusStep,
} from "./steps/trade-application-steps"
import { TRADE_LOCK_OPTIONS, tradeApplicationLockKey } from "./steps/trade-locks"
import { validateRejectionReasonStep } from "./steps/validate-rejection-reason"

/** Rejects a pending application with a reason the customer will see. */
export const rejectTradeApplicationWorkflow = createWorkflow(
  "reject-trade-application",
  function (input: { id: string; reason: string }) {
    const reason = validateRejectionReasonStep(input)
    const lock = transform({ input }, ({ input }) => ({
      key: tradeApplicationLockKey(input.id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(lock)
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
    releaseLockStep(lock)
    return new WorkflowResponse(updated)
  }
)
