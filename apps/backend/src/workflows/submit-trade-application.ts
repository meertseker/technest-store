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
  createTradeApplicationStep,
  CreateTradeApplicationData,
  validateTradeApplicationAllowedStep,
} from "./steps/trade-application-steps"
import { TRADE_LOCK_OPTIONS, tradeCustomerLockKey } from "./steps/trade-locks"

/**
 * Creates a pending application for a customer who has no pending or approved one.
 * A per-customer lock (plus a partial unique index) stops double submits.
 */
export const submitTradeApplicationWorkflow = createWorkflow(
  "submit-trade-application",
  function (input: CreateTradeApplicationData) {
    const lock = transform({ input }, ({ input }) => ({
      key: tradeCustomerLockKey(input.customer_id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(lock)
    const check = transform({ input }, ({ input }) => ({ customer_id: input.customer_id }))
    validateTradeApplicationAllowedStep(check)
    const application = createTradeApplicationStep(input)
    const event = transform({ application }, ({ application }) => ({
      eventName: TRADE_EVENTS.CREATED,
      data: { id: application.id, customer_id: application.customer_id },
    }))
    emitEventStep(event)
    releaseLockStep(lock)
    return new WorkflowResponse(application)
  }
)
