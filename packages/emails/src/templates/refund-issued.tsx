import { Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting, OrderButton } from "../components/parts"
import { formatPence } from "../money"
import type { RefundIssuedData } from "../order-types"

export const subject = (d: RefundIssuedData) =>
  `Refund of ${formatPence(d.amount_pence)} for order #${d.display_id}`

export function Email(d: RefundIssuedData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={{ ...styles.p, fontWeight: 700 }}>
        {`We've refunded ${formatPence(d.amount_pence)} for order #${d.display_id}${d.full ? " (the full order)" : ""}.`}
      </Text>
      <Text style={styles.p}>
        The money goes back to the card or account you paid with. It usually shows within 5–10
        working days, depending on your bank.
      </Text>
      <Text style={styles.p}>{`Not seen it after 10 working days? Reply to this email or call ${BRAND.phone}.`}</Text>
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
