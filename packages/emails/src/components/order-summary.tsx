import { Column, Row, Section, Text } from "@react-email/components"
import { BRAND } from "../brand"
import { formatPence } from "../money"
import type { OrderEmailData } from "../order-types"
import { styles } from "./layout"

const cell = { ...styles.p, margin: "0 0 8px" }
const right = { ...cell, textAlign: "right" as const }
const amountCol = { width: "110px" }

function Line({ label, amount, bold }: { label: string; amount: string; bold?: boolean }) {
  const weight = bold ? { fontWeight: 700 } : {}
  return (
    <Row>
      <Column>
        <Text style={{ ...cell, ...weight }}>{label}</Text>
      </Column>
      <Column style={amountCol}>
        <Text style={{ ...right, ...weight }}>{amount}</Text>
      </Column>
    </Row>
  )
}

export function OrderSummary({ order }: { order: OrderEmailData }) {
  return (
    <Section style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: "12px" }}>
      {order.items.map((item, i) => (
        <Line
          key={i}
          label={`${item.quantity} × ${item.title}${item.variant_title ? ` (${item.variant_title})` : ""}`}
          amount={formatPence(item.total_pence)}
        />
      ))}
      <Line label="Subtotal" amount={formatPence(order.subtotal_pence)} />
      {order.discount_total_pence > 0 ? (
        <Line label="Discount" amount={`−${formatPence(order.discount_total_pence)}`} />
      ) : null}
      <Line
        label={order.fulfilment.method_name}
        amount={order.shipping_total_pence ? formatPence(order.shipping_total_pence) : "Free"}
      />
      <Line label="Total" amount={formatPence(order.total_pence)} bold />
      <Text style={styles.muted}>{`Total includes VAT of ${formatPence(order.tax_total_pence)}.`}</Text>
    </Section>
  )
}
