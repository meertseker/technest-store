import { Button, Heading, Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { OrderSummary } from "../components/order-summary"
import type { OrderEmailData } from "../order-types"

export const subject = (o: OrderEmailData) => `Order confirmed: #${o.display_id}`

export function Email(o: OrderEmailData) {
  const a = o.shipping_address
  const isCollection = o.fulfilment.type === "collection"
  return (
    <Layout preview={`Thanks for your order #${o.display_id}`}>
      <Heading as="h1" style={{ fontSize: "22px", color: BRAND.text, margin: "0 0 16px" }}>
        {`Thanks for your order, ${o.first_name || "there"}`}
      </Heading>
      <Text style={styles.p}>{`Your order number is #${o.display_id}.`}</Text>

      <OrderSummary order={o} />

      {isCollection ? (
        <>
          <Text style={{ ...styles.p, fontWeight: 700 }}>Click &amp; Collect</Text>
          <Text style={styles.p}>
            {`We'll email you when your order is ready for collection from ${BRAND.name}, ${BRAND.address}. Please bring your order number (#${o.display_id}). Nothing is taken from your card until you collect.`}
          </Text>
        </>
      ) : (
        <>
          <Text style={{ ...styles.p, fontWeight: 700 }}>{o.fulfilment.method_name}</Text>
          {a ? (
            <Text style={styles.p}>
              {[a.name, a.address_1, a.address_2, a.city, a.postcode].filter(Boolean).join(", ")}
            </Text>
          ) : null}
          <Text style={styles.p}>{"We'll email you when it's on its way."}</Text>
        </>
      )}

      <Button href={o.order_url} style={styles.button}>
        View your order
      </Button>

      <Text style={{ ...styles.muted, marginTop: "24px" }}>
        {`Changed your mind? You can cancel within 14 days of receiving your items, for any reason. Just reply to this email or call ${BRAND.phone}. See our returns page for details.`}
      </Text>
    </Layout>
  )
}
