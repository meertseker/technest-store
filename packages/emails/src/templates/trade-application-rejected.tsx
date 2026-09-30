import { Button, Text } from "@react-email/components"
import { BRAND, storefrontUrl } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting } from "../components/parts"
import type { TradeApplicationEmailData } from "../trade-types"

export const subject = (_: TradeApplicationEmailData) => "About your Tech Nest trade account application"

export function Email(d: TradeApplicationEmailData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>
        {`Thanks for applying for a trade account for ${d.company_name}. We can't approve it at the moment.`}
      </Text>
      {d.reason ? <Text style={styles.p}>{`Reason: ${d.reason}`}</Text> : null}
      <Text style={styles.p}>
        {`You can still shop at our normal prices, and you're welcome to apply again. Questions? Call ${BRAND.phone} or reply to this email.`}
      </Text>
      <Button href={`${storefrontUrl()}/trade/apply`} style={styles.button}>
        Apply again
      </Button>
    </Layout>
  )
}
