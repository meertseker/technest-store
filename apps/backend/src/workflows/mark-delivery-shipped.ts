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
import { prepareShipmentStep, shipPackedFulfillmentsStep } from "./steps/delivery/prepare-shipment"
import { lockOwnerStep } from "./steps/lock-owner"

export type MarkDeliveryShippedInput = {
  order_id: string
  /** Admin user id, recorded on the fulfilment and the shipment. */
  actor_id?: string
  /** Carrier tracking, already validated by the route; goes on every parcel this press ships. */
  tracking_number?: string
  tracking_url?: string
}

/** Medusa's label shape; `label_url` is for a printable label, which the shop has none of. */
export function trackingLabels(input: Pick<MarkDeliveryShippedInput, "tracking_number" | "tracking_url">) {
  return input.tracking_number
    ? [{ tracking_number: input.tracking_number, tracking_url: input.tracking_url ?? "", label_url: "" }]
    : []
}

/**
 * Delivery order packed and handed to the carrier. Ships every fulfilment
 * that was packed but never marked shipped, then fulfils and ships whatever
 * is left. Each shipment is what the customer hears about: `shipment.created`
 * sends the "on its way" email (subscribers/order-dispatched-email).
 *
 * Refused until the payment has been taken. The order's lock is the one the
 * payment capture uses, so the two never run side by side. Pressing the button
 * twice ships once: the second run is a no-op.
 */
export const markDeliveryShippedWorkflow = createWorkflow(
  "mark-delivery-shipped",
  function (input: MarkDeliveryShippedInput) {
    const owner = lockOwnerStep({ workflow: "mark-delivery-shipped" })
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: deliveryLockKey(input.order_id),
      // A second press waits for the first, then no-ops.
      timeout: 10,
      ttl: 60,
    }))
    acquireLockStep(lock)

    const prepared = prepareShipmentStep({ order_id: input.order_id })

    const sentPacked = when(
      "ship-packed-fulfilments",
      { prepared },
      ({ prepared }) => prepared.unshipped_fulfillments.length > 0
    ).then(() => {
      const packed = transform({ input, prepared }, ({ input, prepared }) => ({
        order_id: input.order_id,
        fulfillments: prepared.unshipped_fulfillments,
        created_by: input.actor_id,
        labels: trackingLabels(input),
      }))
      return shipPackedFulfillmentsStep(packed)
    })

    const shipped = when("ship-remaining-items", { prepared }, ({ prepared }) => prepared.items.length > 0).then(
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
            labels: trackingLabels(input),
            no_notification: false,
          })
        )
        createOrderShipmentWorkflow.runAsStep({ input: shipmentInput })
        return fulfillment
      }
    )

    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: deliveryLockKey(input.order_id),
      ownerId: owner,
    }))
    releaseLockStep(unlock)

    const result = transform(
      { input, prepared, shipped, sentPacked },
      ({ input, prepared, shipped, sentPacked }) => ({
        order_id: input.order_id,
        fulfillment_id: prepared.already_shipped
          ? prepared.fulfillment_id
          : (shipped?.id ?? sentPacked?.[sentPacked.length - 1] ?? null),
        already_shipped: prepared.already_shipped,
      })
    )
    return new WorkflowResponse(result)
  }
)
