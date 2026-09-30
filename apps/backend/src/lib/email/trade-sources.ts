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

/** Default per-variant reorder level (docs/contracts/product-attributes.md). */
export const DEFAULT_REORDER_LEVEL = 3

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

const str = (v: unknown) => (typeof v === "string" ? v : "")

async function loadApplication(container: MedusaContainer, id: string): Promise<Row | undefined> {
  const { data } = await query(container).graph({
    // Entity from E1's trade module (docs/contracts/trade.md). Its columns are
    // contact_name/contact_phone/contact_email; the API nests them as `contact`.
    entity: "trade_application",
    fields: ["*"],
    filters: { id },
  } as any)
  return data[0] as Row | undefined
}

type TradeStatus = "pending" | "approved" | "rejected"

/**
 * Customer trade emails. They go to the customer's ACCOUNT email (the login),
 * never the typed contact email, so the form can't be used to send our mail
 * to arbitrary addresses. `status` is the status the application must have
 * now: an approval email is never sent for an application that isn't approved.
 */
export function tradeApplicationCustomer(status?: TradeStatus) {
  return async (
    container: MedusaContainer,
    applicationId: string,
    recipient: EmailRecipient
  ): Promise<ResolvedEmail | null> => {
    if (recipient !== "customer") return null
    const app = await loadApplication(container, applicationId)
    if (!app?.customer_id || (status && app.status !== status)) return null

    const { data: customers } = await query(container).graph({
      entity: "customer",
      fields: ["email", "first_name"],
      filters: { id: app.customer_id },
    })
    const customer = customers[0]
    if (!customer?.email) return null
    const data: TradeApplicationEmailData = {
      first_name: safeFirstName(customer.first_name),
      company_name: str(app.company_name),
      // Written by staff for the customer (contract: "shown to the customer").
      reason: app.status === "rejected" ? str(app.reason) || null : null,
    }
    return { to: customer.email, data: asData(data) }
  }
}

/** technest.trade_application.created → shop copy with the typed contact details, for the call back. */
export async function tradeApplicationShop(
  container: MedusaContainer,
  applicationId: string,
  recipient: EmailRecipient
): Promise<ResolvedEmail | null> {
  if (recipient !== "shop") return null
  const app = await loadApplication(container, applicationId)
  if (!app) return null
  const data: ShopTradeApplicationData = {
    company_name: str(app.company_name),
    business_type: str(app.business_type),
    vat_number: app.vat_number ?? null,
    companies_house_number: app.companies_house_number ?? null,
    contact: {
      name: str(app.contact_name ?? app.contact?.name),
      phone: str(app.contact_phone ?? app.contact?.phone),
      email: str(app.contact_email ?? app.contact?.email),
    },
    admin_url: `${adminBase()}/trade-applications/${encodeURIComponent(app.id)}`,
  }
  return { to: shopNotifyEmail(), data: asData(data) }
}

/** technest.repair_booking.created → shop only (the shop calls the customer back). */
export async function repairBooking(
  container: MedusaContainer,
  bookingId: string,
  recipient: EmailRecipient
): Promise<ResolvedEmail | null> {
  if (recipient !== "shop") return null
  const { data: rows } = await query(container).graph({
    // Entity from E1's repair module (docs/contracts/repairs.md).
    entity: "repair_booking",
    fields: ["*"],
    filters: { id: bookingId },
  } as any)
  const b = rows[0] as Row | undefined
  if (!b) return null
  const data: ShopRepairBookingData = {
    name: str(b.name),
    phone: str(b.phone),
    email: str(b.email),
    device: str(b.device),
    fault: str(b.fault),
    preferred_time: str(b.preferred_time),
    admin_url: `${adminBase()}/repair-bookings/${encodeURIComponent(b.id)}`,
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

/** "2026-10-05" in shop time: one low-stock digest per shop day. */
export const londonDay = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now)

/** Most variants one digest lists (bounds the query and the persisted workflow input). */
export const MAX_DIGEST_VARIANTS = 200

const level = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
  return Number.isInteger(n) && n >= 0 ? n : undefined
}

/**
 * Reorder levels by product id from E1's product attributes link
 * (`product.product_attributes.reorder_level`, docs/contracts/product-attributes.md).
 * `null` when that module isn't installed.
 */
async function attributeLevels(
  container: MedusaContainer,
  productIds: string[]
): Promise<Map<string, number | undefined> | null> {
  if (!productIds.length) return new Map()
  try {
    const { data } = await query(container).graph({
      entity: "product",
      fields: ["id", "product_attributes.reorder_level"],
      filters: { id: productIds },
    } as any)
    return new Map((data as Row[]).map((p) => [p.id, level(p.product_attributes?.reorder_level)]))
  } catch {
    return null
  }
}

/** technest.inventory.low_stock → shop only; nothing when no variant is listed. */
export async function lowStockDigest(
  container: MedusaContainer,
  _digestId: string,
  recipient: EmailRecipient,
  variantIds: string[] = []
): Promise<ResolvedEmail | null> {
  const ids = [...new Set(variantIds.filter((id) => typeof id === "string" && id))].slice(0, MAX_DIGEST_VARIANTS)
  if (recipient !== "shop" || !ids.length) return null
  const { data: variants } = await query(container).graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "sku",
      "metadata",
      "product.id",
      "product.title",
      "inventory_items.inventory.location_levels.stocked_quantity",
    ],
    filters: { id: ids },
  })
  if (!variants.length) return null

  const attributes = await attributeLevels(container, [
    ...new Set((variants as Row[]).map((v) => v.product?.id).filter(Boolean) as string[]),
  ])

  const lines: LowStockLine[] = (variants as Row[])
    .map((v) => {
      const stock = (v.inventory_items ?? []).flatMap((ii: Row | null) => ii?.inventory?.location_levels ?? [])
      return {
        product_title: str(v.product?.title) || str(v.title),
        variant_title: v.title ?? null,
        sku: v.sku ?? null,
        stocked: stock.length
          ? stock.reduce((sum: number, l: Row | null) => sum + Number(l?.stocked_quantity ?? 0), 0)
          : null,
        // Product attributes (admin-editable) first, then the seed's variant
        // metadata, then the attributes default.
        reorder_level:
          attributes?.get(v.product?.id) ??
          level(v.metadata?.reorder_level) ??
          (attributes ? DEFAULT_REORDER_LEVEL : null),
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
