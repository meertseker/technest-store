import { Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { Greeting } from "../components/parts"
import type { TradeApplicationEmailData } from "../trade-types"

export const subject = (_: TradeApplicationEmailData) => "We've received your trade account application"

export function Email(d: TradeApplicationEmailData) {
  return (
    <Layout preview={subject(d)}>
      <Greeting first_name={d.first_name} />
      <Text style={styles.p}>{`Thanks for applying for a Tech Nest trade account for ${d.company_name}.`}</Text>
      <Text style={styles.p}>
        {`We check every application by hand, usually within 1–2 working days, and we'll email you as soon as it's decided. Questions? Call ${BRAND.phone}.`}
      </Text>
    </Layout>
  )
}
