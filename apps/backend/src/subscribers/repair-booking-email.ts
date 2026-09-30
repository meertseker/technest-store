import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { runEmail } from "../lib/email/run-email"

export const REPAIR_BOOKING_CREATED = "technest.repair_booking.created"

/**
 * technest.repair_booking.created `{ id }` → "Repair request" to the shop,
 * which calls the customer back (docs/contracts/repairs.md). The customer
 * gets no email: the booking form is public, so an email to the typed
 * address would let anyone send our mail to anyone.
 */
export default async function repairBookingEmail({ event: { name, data }, container }: SubscriberArgs<{ id: string }>) {
  if (typeof data?.id !== "string" || !data.id) return
  await runEmail(container, {
    template: "shop-repair-booking",
    recipient: "shop",
    resource_id: data.id,
    resource_type: "repair_booking",
    trigger_type: name,
  })
}

export const config: SubscriberConfig = { event: REPAIR_BOOKING_CREATED }
