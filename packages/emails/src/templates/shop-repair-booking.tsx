import { Button, Link, Text } from "@react-email/components"
import { Layout, styles } from "../components/layout"
import { oneLine } from "../text"
import type { ShopRepairBookingData } from "../trade-types"

export const subject = (d: ShopRepairBookingData) => `Repair request: ${oneLine(d.device)}`

const row = (label: string, value: string) => (
  <Text style={{ ...styles.p, margin: "0 0 8px" }}>{`${label}: ${value}`}</Text>
)

export function Email(d: ShopRepairBookingData) {
  const tel = d.phone.replace(/[^\d+]/g, "")
  return (
    <Layout preview={`Call back ${oneLine(d.name, 40)} about their ${oneLine(d.device)}`}>
      <Text style={{ ...styles.p, fontWeight: 700 }}>New repair request. Please call the customer back.</Text>
      {row("Name", d.name)}
      {tel ? (
        <Text style={{ ...styles.p, margin: "0 0 8px" }}>
          {"Phone: "}
          <Link href={`tel:${tel}`} style={styles.link}>
            {d.phone}
          </Link>
        </Text>
      ) : (
        row("Phone", d.phone)
      )}
      {row("Email", d.email)}
      {row("Device", d.device)}
      {row("Fault", d.fault)}
      {row("Best time to call", d.preferred_time)}
      <Button href={d.admin_url} style={{ ...styles.button, marginTop: "8px" }}>
        Open the repair queue
      </Button>
    </Layout>
  )
}
