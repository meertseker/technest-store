import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import {
  listCustomerTradeApplicationIdsStep,
  softDeleteTradeApplicationsStep,
} from "./steps/trade-application-steps"
import { TRADE_LOCK_OPTIONS, tradeCustomerLockKey } from "./steps/trade-locks"

/**
 * When a customer account is deleted, their trade applications (company,
 * contact name, phone, email) go with it: every application of the customer
 * is soft-deleted, whatever its status, and the retention job removes the rows
 * for good later. Run by the `customer.deleted` subscriber.
 */
export const deleteCustomerTradeApplicationsWorkflow = createWorkflow(
  "delete-customer-trade-applications",
  function (input: { customer_id: string }) {
    const lock = transform({ input }, ({ input }) => ({
      key: tradeCustomerLockKey(input.customer_id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(lock)
    const found = listCustomerTradeApplicationIdsStep(input)
    const deleted = softDeleteTradeApplicationsStep(found)
    releaseLockStep(lock)
    return new WorkflowResponse(deleted)
  }
)
