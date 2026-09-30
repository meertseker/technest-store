import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { collectLockKey } from "../lib/click-collect"
import { captureOrderPaymentsStep } from "./steps/click-collect/capture-order-payments"
import { prepareDeliveryCaptureStep } from "./steps/click-collect/prepare-delivery-capture"

export type CaptureDeliveryOrderInput = { order_id: string }

/**
 * Captures the authorised payment of a delivery order (run on order.placed).
 * Click & Collect orders are left authorised. A per-order lock plus the
 * "already captured" check make duplicate events harmless.
 */
export const captureDeliveryOrderWorkflow = createWorkflow(
  "capture-delivery-order",
  function (input: CaptureDeliveryOrderInput) {
    const lock = transform({ input }, ({ input }) => ({
      key: collectLockKey(input.order_id),
      timeout: 10,
      ttl: 60,
    }))
    acquireLockStep(lock)

    const prepared = prepareDeliveryCaptureStep({ order_id: input.order_id })

    const captured = when("capture-if-delivery", { prepared }, ({ prepared }) => !prepared.skipped)
      .then(() => {
        const capture = transform({ input, prepared }, ({ input, prepared }) => ({
          order_id: input.order_id,
          payment_ids: prepared.payment_ids,
        }))
        return captureOrderPaymentsStep(capture)
      })

    const unlock = transform({ input }, ({ input }) => ({ key: collectLockKey(input.order_id) }))
    releaseLockStep(unlock)

    const result = transform({ prepared, captured }, ({ prepared, captured }) => ({
      skipped: prepared.skipped,
      captured_payment_ids: captured ?? [],
    }))
    return new WorkflowResponse(result)
  }
)
