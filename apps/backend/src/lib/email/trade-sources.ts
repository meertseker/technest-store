import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  LowStockLine,
  ShopLowStockDigestData,
  ShopRepairBookingData,
  ShopTradeApplicationData,
  TradeApplicationEmailData,
} from "@technest/emails"
import { safeFirstName, shopNotifyEmail } from "./order-email-data"
import type { EmailRecipient, ResolvedEmail } from "./sources"

type Row = Record<string, any>

/**
 * Admin links in shop emails. Unlike the staff password-reset link these
 * carry no secret, so fall back to the production admin instead of failing.
 */
export const adminBase = () =>
  (
    process.env.ADMIN_URL ||
    (process.env.MEDUSA_BACKEND_URL ? `${process.env.MEDUSA_BACKEND_URL.replace(/\/$/, "")}/app` : "") ||
    "https://admin.technest.co.uk/app"
  ).replace(/\/$/, "")

const query = (container: MedusaContainer) => container.resolve(ContainerRegistrationKeys.QUERY)

const asData = (d: object) => d as Record<string, unknown>

async function loadApplication(container: MedusaContainer, id: string): Promise<Row | undefined> {
  const { data } = await query(container).graph({
    // Entity from the trade module (C2, docs/contracts/trade.md).
    entity: "trade_application",
    fields: ["*"],
    filters: { id },
  } as any)
  return data[0] as Row | undefined
}

/**
 * Trade application emails to the applicant go to the customer's ACCOUNT
 * email (verified at sign-up), never the typed contact.email, so the form
 * can't be used to send our mail to arbitrary addresses. The shop copy
 * shows the typed contact details for the call back.
 */
export async function tradeApplication(
  container: MedusaContainer,
  applicationId: string,
  recipient: EmailRecipient
): Promise<ResolvedEmail | null> {
  const app = await loadApplication(container, applicationId)
  if (!app) return null

  if (recipient === "shop") {
    const data: ShopTradeApplicationData = {
      company_name: app.company_name,
      business_type: app.business_type,
      vat_number: app.vat_number ?? null,
      companies_house_number: app.companies_house_number ?? null,
      contact: {
        name: app.contact?.name ?? "",
        phone: app.contact?.phone ?? "",
        email: app.contact?.email ?? "",
      },
      admin_url: `${adminBase()}/trade-applications/${app.id}`,
    }
    return { to: shopNotifyEmail(), data: asData(data) }
  }

  const { data: customers } = await query(container).graph({
    entity: "customer",
    fields: ["email", "first_name"],
    filters: { id: app.customer_id },
  })
  const customer = customers[0]
  if (!customer?.email) return null
  const data: TradeApplicationEmailData = {
    first_name: safeFirstName(customer.first_name),
    company_name: app.company_name,
    reason: app.status === "rejected" ? app.reason ?? null : null,
  }
  return { to: customer.email, data: asData(data) }
}

/** technest.repair_booking.created → shop only (the shop calls the customer back). */
export async function repairBooking(
  container: MedusaContainer,
  bookingId: string,
  recipient: EmailRecipient
): Promise<ResolvedEmail | null> {
  if (recipient !== "shop") return null
  const { data: rows } = await query(container).graph({
    // Entity from the repair module (C2, docs/contracts/repairs.md).
    entity: "repair_booking",
    fields: ["*"],
    filters: { id: bookingId },
  } as any)
  const b = rows[0] as Row | undefined
  if (!b) return null
  const data: ShopRepairBookingData = {
    name: b.name,
    phone: b.phone,
    email: b.email,
    device: b.device,
    fault: b.fault,
    preferred_time: b.preferred_time,
    admin_url: `${adminBase()}/repair-bookings/${b.id}`,
  }
  return { to: shopNotifyEmail(), data: asData(data) }
}

/** "Monday 5 October" in shop time. */
export const londonDate = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(now)

/** technest.stock.low_digest → shop only; nothing when no variant is listed. */
export async function lowStockDigest(
  container: MedusaContainer,
  _digestId: string,
  recipient: EmailRecipient,
  variantIds: string[] = []
): Promise<ResolvedEmail | null> {
  if (recipient !== "shop" || !variantIds.length) return null
  const { data: variants } = await query(container).graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "sku",
      "metadata",
      "product.title",
      "inventory_items.inventory.location_levels.stocked_quantity",
    ],
    filters: { id: variantIds },
  })
  if (!variants.length) return null

  const lines: LowStockLine[] = (variants as Row[])
    .map((v) => {
      const levels = (v.inventory_items ?? []).flatMap(
        (ii: Row | null) => ii?.inventory?.location_levels ?? []
      )
      const reorder = Number(v.metadata?.reorder_level)
      return {
        product_title: v.product?.title ?? v.title,
        variant_title: v.title ?? null,
        sku: v.sku ?? null,
        stocked: levels.length
          ? levels.reduce((sum: number, l: Row | null) => sum + Number(l?.stocked_quantity ?? 0), 0)
          : null,
        reorder_level: Number.isFinite(reorder) ? reorder : null,
      }
    })
    // Emptiest first: those are the ones to reorder today.
    .sort((a, b) => (a.stocked ?? 0) - (b.stocked ?? 0) || a.product_title.localeCompare(b.product_title))

  const data: ShopLowStockDigestData = {
    date: londonDate(),
    lines,
    admin_url: `${adminBase()}/inventory`,
  }
  return { to: shopNotifyEmail(), data: asData(data) }
}
