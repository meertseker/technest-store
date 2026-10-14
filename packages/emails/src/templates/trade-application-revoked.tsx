import { Button, Text } from "@react-email/components"
import { BRAND, storefrontUrl } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting } from "../components/parts"
import type { TradeApplicationEmailData } from "../trade-types"

export const subject = (_: TradeApplicationEmailData) => "Your Tech Nest trade account has been closed"

/** Sent when staff revoke an approved trade account. Plain and short; the reason is staff's own words. */
export function Email(d: TradeApplicationEmailData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={{ ...styles.p, fontWeight: 700 }}>Your business no longer has a trade account with Tech Nest.</Text>
      {d.reason ? <Text style={styles.p}>{`Reason: ${d.reason}`}</Text> : null}
      <Text style={styles.p}>
        {`From now on your orders are priced at our normal prices. You're welcome to apply again at any time. Questions? Call ${BRAND.phone} or reply to this email.`}
      </Text>
      <Button href={`${storefrontUrl()}/trade/apply`} style={styles.button}>
        Apply again
      </Button>
    </Layout>
  )
}
