import { Link, Section, Text } from "@react-email/components"
import { BRAND, MAP_URL } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting, Lines, OrderButton } from "../components/parts"
import type { CollectionData } from "../order-types"

export const subject = (d: CollectionData) => `Your order #${d.display_id} is ready to collect`

export function CollectionDetails({ d }: { d: CollectionData }) {
  return (
    <Section
      style={{ backgroundColor: BRAND.surface, borderRadius: "8px", padding: "16px", margin: "0 0 16px" }}
    >
      <Text style={{ ...styles.muted, margin: "0 0 4px" }}>Collection code</Text>
      <Text style={{ fontSize: "28px", lineHeight: "36px", fontWeight: 700, letterSpacing: "2px", color: BRAND.text, margin: "0 0 12px" }}>
        {d.collection_code}
      </Text>
      <Text style={{ ...styles.p, margin: "0 0 4px" }}>{`${BRAND.name}, ${BRAND.address}`}</Text>
      <Text style={{ ...styles.p, margin: "0 0 4px" }}>{d.today_hours}</Text>
      <Text style={{ ...styles.p, margin: 0 }}>
        <Link href={MAP_URL} style={styles.link}>
          Open in Google Maps
        </Link>
      </Text>
    </Section>
  )
}

export function Email(d: CollectionData) {
  return (
    <Layout preview={`Ready to collect. Collection code ${d.collection_code}`}>
      <Greeting first_name={d.first_name} />
      <Text style={{ ...styles.p, fontWeight: 700 }}>{`Order #${d.display_id} is packed and waiting for you at the shop.`}</Text>
      <CollectionDetails d={d} />
      <Text style={styles.p}>
        {`Bring your order number (#${d.display_id}) or show this email at the counter. We'll take payment from your card when you collect.`}
      </Text>
      {d.hold_until ? (
        <Text style={styles.p}>{`We'll keep it for you until ${d.hold_until}.`}</Text>
      ) : null}
      <Lines items={d.items} />
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
