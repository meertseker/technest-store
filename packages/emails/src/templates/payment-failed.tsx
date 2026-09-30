import { Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting, OrderButton } from "../components/parts"
import { formatPence } from "../money"
import type { PaymentFailedData } from "../order-types"

export const subject = (d: PaymentFailedData) =>
  d.for_shop
    ? `Payment capture FAILED: order #${d.display_id} · ${formatPence(d.total_pence)}`
    : `We couldn't take payment for order #${d.display_id}`

export function Email(d: PaymentFailedData) {
  if (d.for_shop) {
    return (
      <Layout preview={subject(d)}>
        <Text style={{ ...styles.p, fontWeight: 700, color: BRAND.destructive }}>
          {`Stripe refused to capture ${formatPence(d.total_pence)} for order #${d.display_id}.`}
        </Text>
        <Text style={styles.p}>
          Don't ship this order yet. The customer has been asked to call the shop. Check the payment in the
          admin (Orders → this order → Payments) and in the Stripe dashboard.
        </Text>
      </Layout>
    )
  }
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>
        {`We couldn't take the payment of ${formatPence(d.total_pence)} for order #${d.display_id}, so we haven't sent it yet.`}
      </Text>
      <Text style={styles.p}>
        {`This sometimes happens when a bank blocks a payment. Please call us on ${BRAND.phone} (Mon–Sat 9am–8pm, Sun 11am–5pm) or reply to this email, and we'll sort it out. We never ask for card details by email.`}
      </Text>
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
