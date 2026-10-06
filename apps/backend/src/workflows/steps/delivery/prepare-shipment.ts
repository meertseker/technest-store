import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"
import {
  deliveryStatusOf,
  loadDeliveryOrder,
  paymentBlocker,
  unfulfilledItems,
  unshippedFulfillments,
} from "../../../lib/delivery"

type OrderItems = { id: string; quantity: number }[]

export type PrepareShipmentOutput = {
  /** True when the whole order has already shipped: nothing to do. */
  already_shipped: boolean
  /** The fulfilment that shipped last, when already shipped. */
  fulfillment_id: string | null
  /** Fulfilments that were packed but never marked shipped. */
  unshipped_fulfillments: { id: string; items: OrderItems }[]
  /** Order items (and quantities) not fulfilled yet. */
  items: OrderItems
}

/**
 * Validates that a delivery order can be marked shipped: not Click & Collect,
 * not a draft, not cancelled, and paid for (payment captured, not refunded in
 * full). Works out what is left to do: ship fulfilments that were packed but
 * never sent, and fulfil and ship whatever is not packed yet. An order that
 * has shipped completely is a no-op.
 */
export const prepareShipmentStep = createStep(
  "prepare-shipment",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadDeliveryOrder(container, order_id)
    if (order.status === "canceled") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Order ${order_id} is cancelled`)
    }
    if (order.status === "draft") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Order ${order_id} is still a draft`)
    }
    if (deliveryStatusOf(order) === "shipped") {
      const shipped = (order.fulfillments ?? [])
        .filter((f): f is NonNullable<typeof f> => !!f && !f.canceled_at && !!f.shipped_at)
        .sort((a, b) => +new Date(b.shipped_at as string) - +new Date(a.shipped_at as string))
      return new StepResponse<PrepareShipmentOutput>({
        already_shipped: true,
        fulfillment_id: shipped[0]?.id ?? null,
        unshipped_fulfillments: [],
        items: [],
      })
    }
    const unpaid = paymentBlocker(order)
    if (unpaid) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, unpaid)
    }
    const items = unfulfilledItems(order)
    const unshipped = unshippedFulfillments(order)
    if (!items.length && !unshipped.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${order_id} has nothing left to ship`
      )
    }
    return new StepResponse<PrepareShipmentOutput>({
      already_shipped: false,
      fulfillment_id: null,
      unshipped_fulfillments: unshipped,
      items,
    })
  }
)

export type ShipPackedFulfillmentsInput = {
  order_id: string
  fulfillments: { id: string; items: OrderItems }[]
  created_by?: string
}

/**
 * Creates the shipment for each fulfilment that was packed but never sent.
 * Each one tells the customer (`shipment.created`), so there is nothing to
 * undo: if a later step fails, these parcels stay shipped and the next press
 * finishes the rest.
 */
export const shipPackedFulfillmentsStep = createStep(
  "ship-packed-fulfillments",
  async (input: ShipPackedFulfillmentsInput, { container }) => {
    const shipped: string[] = []
    for (const fulfillment of input.fulfillments) {
      await createOrderShipmentWorkflow(container).run({
        input: {
          order_id: input.order_id,
          fulfillment_id: fulfillment.id,
          items: fulfillment.items,
          created_by: input.created_by,
          no_notification: false,
        },
      })
      shipped.push(fulfillment.id)
    }
    return new StepResponse(shipped)
  }
)
