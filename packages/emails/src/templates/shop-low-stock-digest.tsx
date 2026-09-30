import { Button, Column, Row, Section, Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import type { ShopLowStockDigestData } from "../trade-types"

export const subject = (d: ShopLowStockDigestData) =>
  `Low stock: ${d.lines.length} item${d.lines.length === 1 ? "" : "s"} to reorder (${d.date})`

function label(l: ShopLowStockDigestData["lines"][number]) {
  const variant = l.variant_title ? ` (${l.variant_title})` : ""
  const sku = l.sku ? ` · ${l.sku}` : ""
  return `${l.product_title}${variant}${sku}`
}

function count(l: ShopLowStockDigestData["lines"][number]) {
  const min = l.reorder_level != null ? ` (min ${l.reorder_level})` : ""
  return `${l.stocked ?? "?"} left${min}`
}

export function Email(d: ShopLowStockDigestData) {
  return (
    <Layout preview={subject(d)}>
      <Text style={{ ...styles.p, fontWeight: 700 }}>These items are at or below their reorder level:</Text>
      <Section style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: "8px" }}>
        {d.lines.map((l, i) => (
          <Row key={i}>
            <Column>
              <Text style={{ ...styles.p, margin: "0 0 8px" }}>{label(l)}</Text>
            </Column>
            <Column style={{ width: "120px" }}>
              <Text style={{ ...styles.p, margin: "0 0 8px", textAlign: "right" }}>{count(l)}</Text>
            </Column>
          </Row>
        ))}
      </Section>
      <Button href={d.admin_url} style={{ ...styles.button, marginTop: "8px" }}>
        Open inventory
      </Button>
    </Layout>
  )
}
