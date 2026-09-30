import { Text } from "@react-email/components"
import { Layout, styles } from "../components/layout"
import { Greeting, Lines, OrderButton } from "../components/parts"
import type { ReturnReceivedData } from "../order-types"

export const subject = (d: ReturnReceivedData) => `We've received your return for order #${d.display_id}`

export function Email(d: ReturnReceivedData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>{`Thanks, we've received these items back from order #${d.display_id}:`}</Text>
      <Lines items={d.items} />
      <Text style={styles.p}>
        {"We'll check them and refund you within 14 days. You'll get another email when the refund is on its way."}
      </Text>
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
