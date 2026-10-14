import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import {
  assertTradeApplicationDeletableStep,
  softDeleteTradeApplicationsStep,
} from "./steps/trade-application-steps"
import { TRADE_LOCK_OPTIONS, tradeApplicationLockKey } from "./steps/trade-locks"

/**
 * Staff delete one trade application (soft delete; the retention job removes
 * it for good later). An approved application whose customer is still in the
 * Trade group is refused: revoke first. The application lock keeps a
 * concurrent approve/reject/revoke from racing the delete.
 */
export const deleteTradeApplicationWorkflow = createWorkflow(
  "delete-trade-application",
  function (input: { id: string }) {
    const lock = transform({ input }, ({ input }) => ({
      key: tradeApplicationLockKey(input.id),
      ...TRADE_LOCK_OPTIONS,
    }))
    acquireLockStep(lock)
    const application = assertTradeApplicationDeletableStep(input)
    const ids = transform({ application }, ({ application }) => ({ ids: [application.id] }))
    softDeleteTradeApplicationsStep(ids)
    releaseLockStep(lock)
    const result = transform({ application }, ({ application }) => ({ id: application.id }))
    return new WorkflowResponse(result)
  }
)
