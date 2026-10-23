// The shop panel's order page in plain words: what was paid, what can still be
// refunded, and whether the order can still be cancelled. Medusa stores
// payment amounts in major units (GBP 3.49 is 3.49); everything returned here
// that ends in `_pence` is integer pence, like the rest of the shop's numbers.

export type PanelPayment = {
  id: string
  amount: number | string
  captured_at?: string | null
  canceled_at?: string | null
  captures?: ({ amount: number | string } | null)[] | null
  refunds?: ({ amount: number | string } | null)[] | null
}

export type PanelOrder = {
  status?: string | null
  fulfillment_status?: string | null
  payment_status?: string | null
  payment_collections?: ({ payments?: (PanelPayment | null)[] | null } | null)[] | null
}

export type PaymentSummary = {
  /** Authorised on the card and not taken yet. */
  held_pence: number
  /** Taken from the card (all captures). */
  captured_pence: number
  refunded_pence: number
  /** What a refund can still give back. */
  refundable_pence: number
  /** The payment a refund goes to: the one with the most left to refund. */
  refund_payment_id: string | null
  /** Every payment was cancelled (the card hold was released). */
  released: boolean
}

export const toPence = (major: number | string | null | undefined): number => {
  const n = typeof major === "string" ? Number(major) : major ?? 0
  return Number.isFinite(n) ? Math.round((n as number) * 100) : 0
}

const sum = (rows: ({ amount: number | string } | null)[] | null | undefined) =>
  (rows ?? []).reduce((total, row) => total + (row ? toPence(row.amount) : 0), 0)

export function paymentsOf(order: PanelOrder): PanelPayment[] {
  return (order.payment_collections ?? [])
    .flatMap((pc) => pc?.payments ?? [])
    .filter((p): p is PanelPayment => !!p)
}

export function summarisePayments(order: PanelOrder): PaymentSummary {
  const payments = paymentsOf(order)
  let held = 0
  let captured = 0
  let refunded = 0
  let best: { id: string; left: number } | null = null
  for (const p of payments) {
    const paid = sum(p.captures)
    const back = sum(p.refunds)
    captured += paid
    refunded += back
    if (!p.canceled_at && paid === 0) held += toPence(p.amount)
    const left = paid - back
    if (left > 0 && (!best || left > best.left)) best = { id: p.id, left }
  }
  return {
    held_pence: held,
    captured_pence: captured,
    refunded_pence: refunded,
    refundable_pence: best?.left ?? 0,
    refund_payment_id: best?.id ?? null,
    released: payments.length > 0 && payments.every((p) => !!p.canceled_at) && captured === 0,
  }
}

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)

/** One sentence about the money, for a shop owner rather than an accountant. */
export function describePayment(s: PaymentSummary, pickup: boolean): string {
  if (s.released) return "The card hold was released. No money was taken."
  if (s.captured_pence > 0) {
    if (s.refunded_pence >= s.captured_pence) return `${money(s.captured_pence)} was paid and has been refunded in full.`
    if (s.refunded_pence > 0) {
      return `${money(s.captured_pence)} paid, ${money(s.refunded_pence)} refunded so far.`
    }
    return `${money(s.captured_pence)} paid.`
  }
  if (s.held_pence > 0) {
    return pickup
      ? `${money(s.held_pence)} is held on the card. It is taken when you press Collected.`
      : `${money(s.held_pence)} is held on the card and is being taken now.`
  }
  return "No payment on this order."
}

/**
 * Cancelling is offered only while nothing was taken or handed over: Medusa
 * refuses to cancel an order with fulfilments, and a taken payment needs a
 * refund instead.
 */
export function canCancel(order: PanelOrder, s: PaymentSummary): boolean {
  if (order.status === "canceled" || order.status === "completed" || order.status === "archived") return false
  if (order.fulfillment_status && order.fulfillment_status !== "not_fulfilled") return false
  return s.captured_pence === 0
}

/**
 * Parses a refund amount typed in pounds ("1", "1.5", "£1.50"). Returns pence,
 * or an error sentence when it is empty, not money, or more than is left.
 */
export function parseRefund(input: string, refundablePence: number): { pence: number } | { error: string } {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { error: "Enter an amount in pounds, like 4.99." }
  const pence = Math.round(Number(cleaned) * 100)
  if (pence <= 0) return { error: "The amount must be more than £0." }
  if (pence > refundablePence) return { error: `You can refund at most ${money(refundablePence)}.` }
  return { pence }
}
