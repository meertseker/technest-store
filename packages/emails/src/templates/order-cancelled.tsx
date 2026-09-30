import { Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting, OrderButton } from "../components/parts"
import { formatPence } from "../money"
import type { OrderCancelledData } from "../order-types"

export const subject = (d: OrderCancelledData) => `Your order #${d.display_id} has been cancelled`

function moneyLine(d: OrderCancelledData) {
  if (d.payment === "refunded" && d.refunded_pence > 0) {
    return `We've refunded ${formatPence(d.refunded_pence)} to your original payment method. It usually shows within 5–10 working days.`
  }
  if (d.payment === "released") {
    return "You haven't been charged. The hold on your card has been released; your bank may take a few days to remove it."
  }
  return "You haven't been charged."
}

export function Email(d: OrderCancelledData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>
        {d.reason === "uncollected"
          ? `Order #${d.display_id} wasn't collected within 7 days, so we've cancelled it and put the items back on the shelf.`
          : `Order #${d.display_id} has been cancelled.`}
      </Text>
      <Text style={styles.p}>{moneyLine(d)}</Text>
      <Text style={styles.p}>{`Questions? Reply to this email or call ${BRAND.phone}.`}</Text>
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
