import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { todaysHours, type CollectionData, type PaymentFailedData } from "@technest/emails"
import { safeFirstName, shopNotifyEmail, storefrontUrl, toPence } from "./order-email-data"
import type { EmailRecipient, ResolvedEmail } from "./sources"

/** Order metadata written by the Click & Collect workflows (docs/contracts/click-collect.md). */
export const COLLECTION_CODE_KEY = "collection_code"
export const READY_AT_KEY = "ready_for_collection_at"
/** Uncollected orders are held this long after "ready" before the auto-cancel. */
export const HOLD_DAYS = 7

type Row = Record<string, any>

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "total",
  "metadata",
  "customer.first_name",
  "shipping_address.first_name",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
]

async function loadOrder(container: MedusaContainer, orderId: string): Promise<Row | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  return data[0] as Row | undefined
}

const ref = (o: Row) => ({
  display_id: o.display_id ?? o.id,
  first_name: safeFirstName(o.customer?.first_name || o.shipping_address?.first_name),
  order_url: `${storefrontUrl()}/order/${o.id}/confirmed`,
})

/** "Friday 9 October" in shop time, HOLD_DAYS after the order was marked ready. */
export function holdUntil(readyAt: unknown): string | null {
  const t = typeof readyAt === "string" ? Date.parse(readyAt) : NaN
  if (!Number.isFinite(t)) return null
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date(t + HOLD_DAYS * 24 * 60 * 60 * 1000))
}

/** Codes are shown big at the counter: keep them short and plain. */
const safeCode = (code: unknown) =>
  typeof code === "string" && /^[A-Z0-9]{4,12}$/.test(code) ? code : null

/** technest.order.ready_for_collection / collection_reminder → customer only. */
export async function collection(
  container: MedusaContainer,
  orderId: string,
  recipient: EmailRecipient
): Promise<ResolvedEmail | null> {
  if (recipient !== "customer") return null
  const o = await loadOrder(container, orderId)
  if (!o?.email) return null
  const data: CollectionData = {
    ...ref(o),
    collection_code: safeCode(o.metadata?.[COLLECTION_CODE_KEY]) ?? `#${o.display_id ?? o.id}`,
    items: (o.items ?? [])
      .filter((i: Row | null): i is Row => !!i)
      .map((i: Row) => ({
        title: i.product_title || i.title,
        variant_title: i.variant_title ?? null,
        quantity: Number(i.quantity),
      })),
    today_hours: todaysHours(),
    hold_until: holdUntil(o.metadata?.[READY_AT_KEY]),
  }
  return { to: o.email, data: data as unknown as Record<string, unknown> }
}

/** technest.payment.capture_failed → customer, and a staff-worded copy to the shop. */
export async function paymentFailed(
  container: MedusaContainer,
  orderId: string,
  recipient: EmailRecipient
): Promise<ResolvedEmail | null> {
  const o = await loadOrder(container, orderId)
  if (!o) return null
  const data: PaymentFailedData = { ...ref(o), total_pence: toPence(o.total), for_shop: recipient === "shop" }
  const to = recipient === "shop" ? shopNotifyEmail() : o.email
  return to ? { to, data: data as unknown as Record<string, unknown> } : null
}
