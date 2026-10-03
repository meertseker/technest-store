import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { deliveryLockKey } from "../lib/delivery"
import { prepareShipmentStep } from "./steps/delivery/prepare-shipment"

export type MarkDeliveryShippedInput = {
  order_id: string
  /** Admin user id, recorded on the fulfilment and the shipment. */
  actor_id?: string
}

/**
 * Delivery order packed and handed to the carrier: fulfils every remaining
 * item and creates the shipment. The shipment is what the customer hears
 * about: `shipment.created` sends the "on its way" email
 * (subscribers/order-dispatched-email). Payment was captured at order time.
 * Pressing the button twice ships once: the second run is a no-op.
 */
export const markDeliveryShippedWorkflow = createWorkflow(
  "mark-delivery-shipped",
  function (input: MarkDeliveryShippedInput) {
    const lock = transform({ input }, ({ input }) => ({
      key: deliveryLockKey(input.order_id),
      // A second press waits for the first, then no-ops.
      timeout: 10,
      ttl: 60,
    }))
    acquireLockStep(lock)

    const prepared = prepareShipmentStep({ order_id: input.order_id })

    const shipped = when("ship-if-needed", { prepared }, ({ prepared }) => !prepared.already_shipped).then(
      () => {
        const fulfilmentInput = transform({ input, prepared }, ({ input, prepared }) => ({
          order_id: input.order_id,
          items: prepared.items,
          created_by: input.actor_id,
          // "Packed" is not news to the customer; the shipment below is.
          no_notification: true,
        }))
        const fulfillment = createOrderFulfillmentWorkflow.runAsStep({ input: fulfilmentInput })
        const shipmentInput = transform(
          { input, prepared, fulfillment },
          ({ input, prepared, fulfillment }) => ({
            order_id: input.order_id,
            fulfillment_id: fulfillment.id,
            items: prepared.items,
            created_by: input.actor_id,
            no_notification: false,
          })
        )
        createOrderShipmentWorkflow.runAsStep({ input: shipmentInput })
        return fulfillment
      }
    )

    const unlock = transform({ input }, ({ input }) => ({ key: deliveryLockKey(input.order_id) }))
    releaseLockStep(unlock)

    const result = transform({ input, prepared, shipped }, ({ input, prepared, shipped }) => ({
      order_id: input.order_id,
      fulfillment_id: prepared.already_shipped ? prepared.fulfillment_id : (shipped?.id ?? null),
      already_shipped: prepared.already_shipped,
    }))
    return new WorkflowResponse(result)
  }
)
