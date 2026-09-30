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
import {
  addCustomerToGroupStep,
  ensureTradeCustomerGroupStep,
} from "./steps/trade-pricing-steps"

/**
 * Approves a pending application: puts the customer in the "Trade" group
 * (creating the group if needed) and marks the application approved.
 * A failure in any later step rolls back the group membership and the group.
 */
export const approveTradeApplicationWorkflow = createWorkflow(
  "approve-trade-application",
  function (input: { id: string }) {
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
    return new WorkflowResponse(updated)
  }
)
