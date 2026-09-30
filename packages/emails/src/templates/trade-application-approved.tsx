import { Button, Text } from "@react-email/components"
import { storefrontUrl } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting } from "../components/parts"
import type { TradeApplicationEmailData } from "../trade-types"

export const subject = (_: TradeApplicationEmailData) => "Your Tech Nest trade account is approved"

export function Email(d: TradeApplicationEmailData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={{ ...styles.p, fontWeight: 700 }}>{`Good news: ${d.company_name} now has a trade account.`}</Text>
      <Text style={styles.p}>
        Sign in to see trade prices (shown ex VAT) and quantity discounts on every product.
      </Text>
      <Button href={`${storefrontUrl()}/account/trade`} style={styles.button}>
        See your trade account
      </Button>
    </Layout>
  )
}
