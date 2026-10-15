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
  retrieveApprovedTradeApplicationStep,
  updateTradeApplicationStatusStep,
} from "./steps/trade-application-steps"
import {
  TRADE_LOCK_OPTIONS,
  tradeApplicationLockKey,
  tradeCustomerLockKey,
} from "./steps/trade-locks"
import { repriceCustomerCartsStep } from "./steps/reprice-customer-carts"
import { removeCustomerFromTradeGroupStep } from "./steps/trade-pricing-steps"

export type RevokeTradeApplicationInput = {
  id: string
  /** Shown to the customer; null or blank means none. */
  reason?: string | null
}

/**
 * Closes an approved trade account: the customer leaves the Trade group (so
 * trade tiers answer 403, new carts price at retail and the customer's open
 * carts are re-priced at retail) and the application is
 * marked revoked with the optional reason. The customer may apply again.
 * Locks the application and the customer so a concurrent review or re-apply
 * waits; a failure after the removal puts the customer back in the group.
 */
export const revokeTradeApplicationWorkflow = createWorkflow(
  "revoke-trade-application",
  function (input: RevokeTradeApplicationInput) {
    const applicationLock = transform({ input }, ({ input }) => ({
      key: tradeApplicationLockKey(input.id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(applicationLock)
    const application = retrieveApprovedTradeApplicationStep(input)
    const customerLock = transform({ application }, ({ application }) => ({
      key: tradeCustomerLockKey(application.customer_id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(customerLock).config({ name: "acquire-trade-customer-lock" })

    const membership = transform({ application }, ({ application }) => ({
      customer_id: application.customer_id,
    }))
    removeCustomerFromTradeGroupStep(membership)
    // Open baskets still hold trade prices; checkout would charge them.
    repriceCustomerCartsStep(membership)

    const update = transform({ input }, ({ input }) => ({
      id: input.id,
      status: "revoked" as const,
      reason: input.reason?.trim() || null,
    }))
    const updated = updateTradeApplicationStatusStep(update)

    const event = transform({ application }, ({ application }) => ({
      eventName: TRADE_EVENTS.REVOKED,
      data: { id: application.id, customer_id: application.customer_id },
    }))
    emitEventStep(event)

    const locks = transform({ input, application }, ({ input, application }) => ({
      key: [tradeApplicationLockKey(input.id), tradeCustomerLockKey(application.customer_id)],
    }))
    releaseLockStep(locks)
    return new WorkflowResponse(updated)
  }
)
