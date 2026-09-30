/**
 * Order confirmation helpers (spec 7.6).
 *
 * Expected delivery follows the seeded shipping option descriptions:
 * - Standard: "Royal Mail, 2-3 working days" -> latest date shown ("by ...").
 * - Next-day: "Order by 3pm Mon-Fri for next working day".
 * Orders after 3pm (London) or at weekends are dispatched the next working day.
 * Bank holidays are not modelled yet (see report), so the date can be a day early
 * around them.
 */
import type { DeliveryKind } from "@lib/basket/shipping-options"

const CUT_OFF_HOUR = 15

type YMD = { y: number; m: number; d: number }

function londonNow(at: Date): YMD & { hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: n("year"), m: n("month"), d: n("day"), hour: n("hour") }
}

/** Calendar maths on a UTC-noon date so DST never shifts the day */
const asDate = ({ y, m, d }: YMD) => new Date(Date.UTC(y, m - 1, d, 12))
const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6

function addWorkingDays(date: Date, days: number): Date {
  const out = new Date(date)
  let left = days
  while (left > 0) {
    out.setUTCDate(out.getUTCDate() + 1)
    if (!isWeekend(out)) left--
  }
  return out
}

/** The working day the parcel leaves the shop */
export function dispatchDate(placedAt: Date): Date {
  const now = londonNow(placedAt)
  const today = asDate(now)
  if (!isWeekend(today) && now.hour < CUT_OFF_HOUR) return today
  return addWorkingDays(today, 1)
}

/** Latest expected delivery date for a delivery kind; null for Click & Collect */
export function expectedDeliveryDate(placedAt: Date, kind: DeliveryKind): Date | null {
  if (kind === "collect") return null
  const dispatch = dispatchDate(placedAt)
  return addWorkingDays(dispatch, kind === "next-day" ? 1 : 3)
}

/** "Friday 3 October" */
export function formatDeliveryDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date)
}

type OrderShippingLike = {
  shipping_methods?: readonly { name?: string | null; amount?: number | null }[] | null
}

/** Which of the three choices an order used, from its shipping method name */
export function orderDeliveryKind(order: OrderShippingLike): DeliveryKind {
  const name = order.shipping_methods?.[0]?.name?.toLowerCase() ?? ""
  if (/collect/.test(name)) return "collect"
  if (/next[\s-]?day/.test(name)) return "next-day"
  return "standard"
}
