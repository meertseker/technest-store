import { Button, Text } from "@react-email/components"
import { Layout, styles } from "../components/layout"
import type { ShopTradeApplicationData } from "../trade-types"

export const subject = (d: ShopTradeApplicationData) => `New trade application: ${d.company_name}`

const row = (label: string, value?: string | null) => (
  <Text style={{ ...styles.p, margin: "0 0 8px" }}>{`${label}: ${value || "not given"}`}</Text>
)

export function Email(d: ShopTradeApplicationData) {
  return (
    <Layout preview={subject(d)}>
      <Text style={{ ...styles.p, fontWeight: 700 }}>A business has applied for a trade account.</Text>
      {row("Company", d.company_name)}
      {row("Business type", d.business_type.replace(/_/g, " "))}
      {row("VAT number", d.vat_number)}
      {row("Companies House number", d.companies_house_number)}
      {row("Contact", d.contact.name)}
      {row("Phone", d.contact.phone)}
      {row("Email", d.contact.email)}
      <Button href={d.admin_url} style={{ ...styles.button, marginTop: "8px" }}>
        Review in the admin
      </Button>
    </Layout>
  )
}
