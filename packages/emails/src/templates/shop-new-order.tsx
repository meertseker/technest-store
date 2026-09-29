import { Text } from "@react-email/components"
import { Layout, styles } from "../components/layout"
import { OrderSummary } from "../components/order-summary"
import { formatPence } from "../money"
import type { OrderEmailData } from "../order-types"

export const subject = (o: OrderEmailData) =>
  `New order #${o.display_id} · ${o.fulfilment.type === "collection" ? "CLICK & COLLECT" : "Delivery"} · ${formatPence(o.total_pence)}`

export function Email(o: OrderEmailData) {
  const isCollection = o.fulfilment.type === "collection"
  return (
    <Layout preview={subject(o)}>
      <Text style={{ ...styles.p, fontWeight: 700 }}>
        {isCollection
          ? 'Click & Collect: pick it, then press "Ready for collection" on the Click & Collect board.'
          : `Ship with: ${o.fulfilment.method_name}`}
      </Text>
      <OrderSummary order={o} />
    </Layout>
  )
}
