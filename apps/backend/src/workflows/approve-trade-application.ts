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
import {
  addCustomerToGroupStep,
  ensureTradeCustomerGroupStep,
} from "./steps/trade-pricing-steps"

/**
 * Approves a pending application: puts the customer in the "Trade" group
 * (creating the group if needed) and marks the application approved.
 * A failure in any later step rolls back the group membership and the group.
 * A lock on the application stops two reviewers approving/rejecting it at once.
 */
export const approveTradeApplicationWorkflow = createWorkflow(
  "approve-trade-application",
  function (input: { id: string }) {
    const lock = transform({ input }, ({ input }) => ({
      key: tradeApplicationLockKey(input.id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(lock)
    const application = retrievePendingTradeApplicationStep(input)
    const groupId = ensureTradeCustomerGroupStep()
    const membership = transform({ application, groupId }, ({ application, groupId }) => ({
      customer_id: application.customer_id,
      customer_group_id: groupId,
    }))
    addCustomerToGroupStep(membership)
    const update = transform({ input }, ({ input }) => ({
      id: input.id,
      status: "approved" as const,
      reason: null,
    }))
    const updated = updateTradeApplicationStatusStep(update)
    const event = transform({ application }, ({ application }) => ({
      eventName: TRADE_EVENTS.APPROVED,
      data: { id: application.id, customer_id: application.customer_id },
    }))
    emitEventStep(event)
    releaseLockStep(lock)
    return new WorkflowResponse(updated)
  }
)
