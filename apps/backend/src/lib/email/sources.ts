import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { collection, paymentFailed } from "./collection-sources"
import * as lifecycle from "./lifecycle-sources"
import { lowStockDigest, repairBooking, tradeApplicationCustomer, tradeApplicationShop } from "./trade-sources"
import { loadOrderEmailData, safeFirstName, shopNotifyEmail } from "./order-email-data"

export type EmailRecipient = "customer" | "shop"

export type ResolvedEmail = { to: string; data: Record<string, unknown> }

type Source = (
  container: MedusaContainer,
  resourceId: string,
  recipient: EmailRecipient,
  /** Extra non-PII ids (e.g. the variants in a low-stock digest). */
  ids?: string[]
) => Promise<ResolvedEmail | null>

const orderEmail: Source = async (container, orderId, recipient) => {
  const { email, data } = await loadOrderEmailData(container, orderId)
  const to = recipient === "shop" ? shopNotifyEmail() : email
  return to ? { to, data: data as unknown as Record<string, unknown> } : null
}

const welcome: Source = async (container, customerId, recipient) => {
  if (recipient !== "customer") return null
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["email", "first_name", "has_account"],
    filters: { id: customerId },
  })
  const customer = data[0]
  // Guest checkouts create customers too; only registered accounts get a welcome.
  if (!customer?.has_account || !customer.email) return null
  return { to: customer.email, data: { first_name: safeFirstName(customer.first_name) } }
}

/**
 * Template id → how to find its recipient and data from an entity id.
 * Workflow inputs carry only these ids (they're persisted by the workflow
 * engine), and each attempt loads fresh data here.
 */
const sources: Record<string, Source> = {
  "order-confirmation": orderEmail,
  "shop-new-order": orderEmail,
  welcome,
  "order-dispatched": (c, id) => lifecycle.orderDispatched(c, id),
  "order-cancelled": (c, id) => lifecycle.orderCancelled(c, id),
  "refund-issued": (c, id) => lifecycle.refundIssued(c, id),
  "return-received": (c, id) => lifecycle.returnReceived(c, id),
  "ready-for-collection": collection,
  "collection-reminder": collection,
  "payment-failed": paymentFailed,
  "trade-application-received": tradeApplicationCustomer(),
  "trade-application-approved": tradeApplicationCustomer("approved"),
  "trade-application-rejected": tradeApplicationCustomer("rejected"),
  "shop-trade-application": tradeApplicationShop,
  "shop-repair-booking": repairBooking,
  "shop-low-stock-digest": lowStockDigest,
}

/** null = nothing to send (e.g. guest customer, order without an email). */
export async function resolveEmail(
  container: MedusaContainer,
  template: string,
  resourceId: string,
  recipient: EmailRecipient,
  ids?: string[]
): Promise<ResolvedEmail | null> {
  // Reject anything else (e.g. inputs stored by an older version of the
  // workflow) rather than guess, so a shop alert never reaches a customer.
  if (recipient !== "customer" && recipient !== "shop") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown email recipient "${recipient}"`)
  }
  const source = sources[template]
  if (!source) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `No email source for template "${template}"`)
  }
  return source(container, resourceId, recipient, ids)
}
