import { Button, Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { formatPence } from "../money"
import type { ShopPaymentNoticeData } from "../order-types"

export const subject = (d: ShopPaymentNoticeData) => {
  switch (d.kind) {
    case "external_refund":
      return `Refund of ${formatPence(d.amount_pence)} made in Stripe, not the admin: order #${d.display_id}`
    case "hold_released":
      return `Card hold released at Stripe: order #${d.display_id} can't be charged`
    case "collected_outside_board":
      return `Order #${d.display_id} was handed over outside the Click & Collect board`
  }
}

/**
 * Staff only: something happened to an order's payment outside the admin.
 * One bold line saying what, one or two lines saying what to do, and the
 * order to open. Nothing here is a customer email.
 */
export function Email(d: ShopPaymentNoticeData) {
  const amount = formatPence(d.amount_pence)
  const order = `order #${d.display_id}`
  let lead: string
  let next: string
  switch (d.kind) {
    case "external_refund":
      lead = `${amount} of ${order} was refunded in the Stripe dashboard.`
      next = d.unrecorded
        ? "Medusa had not taken this payment, so the refund could not be written to the order. Check the payment in Stripe and in the admin, and tell the lead."
        : "It has been written to the order, and the customer has been emailed the usual refund notice. Next time, refund from the order page in the admin: that does all of this in one step."
      break
    case "hold_released":
      lead = `The card hold of ${amount} on ${order} was released at Stripe${d.reason ? ` (reason: ${d.reason})` : ""}.`
      next =
        "The payment cannot be captured any more. Don't ship or hand over this order: ask the customer to pay again, or cancel the order in the admin."
      break
    case "collected_outside_board":
      lead = `${order} was marked delivered on Medusa's order page instead of the Click & Collect board.`
      next = `The payment of ${amount} has now been taken and the order marked collected. For pickups please use the Click & Collect board: "Collected" takes the payment at the counter; the order page does not.`
      break
  }
  return (
    <Layout preview={subject(d)}>
      <Text style={{ ...styles.p, fontWeight: 700, color: d.kind === "hold_released" ? BRAND.destructive : BRAND.text }}>
        {lead}
      </Text>
      <Text style={styles.p}>{next}</Text>
      <Button href={d.admin_order_url} style={styles.button}>
        Open the order in the admin
      </Button>
    </Layout>
  )
}
