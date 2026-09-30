import { Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting, OrderButton } from "../components/parts"
import type { CollectionData } from "../order-types"
import { CollectionDetails } from "./ready-for-collection"

export const subject = (d: CollectionData) => `Reminder: order #${d.display_id} is waiting for you`

export function Email(d: CollectionData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>{`Just a reminder: order #${d.display_id} is still waiting for you at the shop.`}</Text>
      <CollectionDetails d={d} />
      <Text style={styles.p}>
        {d.hold_until
          ? `We'll keep it until ${d.hold_until}. After that we'll cancel the order and release the hold on your card, so you won't be charged.`
          : "We keep orders for 7 days. After that we cancel the order and release the hold on your card, so you won't be charged."}
      </Text>
      <Text style={styles.p}>{`Can't make it? Call us on ${BRAND.phone} or reply to this email.`}</Text>
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
