import { Link, Text } from "@react-email/components"
import { Layout, styles } from "../components/layout"
import { Greeting, Lines, OrderButton } from "../components/parts"
import type { OrderDispatchedData } from "../order-types"

export const subject = (d: OrderDispatchedData) => `Your order #${d.display_id} is on its way`

// Tracking links come from the carrier; only ever link http(s).
const safeUrl = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : null)

export function Email(d: OrderDispatchedData) {
  const a = d.shipping_address
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>{`Good news: order #${d.display_id} has left the shop.`}</Text>
      <Lines items={d.items} />
      {a ? (
        <Text style={styles.p}>
          {`Going to: ${[a.name, a.address_1, a.address_2, a.city, a.postcode].filter(Boolean).join(", ")}`}
        </Text>
      ) : null}
      {d.tracking.map((t, n) => {
        const url = safeUrl(t.url)
        return (
          <Text key={n} style={styles.p}>
            {`Tracking number: ${t.number}`}
            {url ? (
              <>
                {" · "}
                <Link href={url} style={styles.link}>
                  Track your parcel
                </Link>
              </>
            ) : null}
          </Text>
        )
      })}
      <OrderButton href={d.order_url} />
    </Layout>
  )
}
