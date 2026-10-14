import { Button, Link, Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"
import { formatPence } from "../money"
import type { ShopPaymentDisputeData } from "../order-types"

export const subject = (d: ShopPaymentDisputeData) =>
  `Chargeback on order #${d.display_id}: ${formatPence(d.amount_pence)}` +
  (d.due_by ? `, respond by ${d.due_by}` : "")

const row = (label: string, value: string) => (
  <Text style={{ ...styles.p, margin: "0 0 8px" }}>{`${label}: ${value}`}</Text>
)

/**
 * Staff only. A customer's bank has taken the money back pending a decision;
 * the only thing that helps is evidence in Stripe before the deadline, so the
 * deadline and the Stripe link come first. Said in words, not colour alone.
 */
export function Email(d: ShopPaymentDisputeData) {
  return (
    <Layout preview={subject(d)}>
      <Text style={{ ...styles.p, fontWeight: 700, color: BRAND.destructive }}>
        {`A customer has disputed ${formatPence(d.amount_pence)} of order #${d.display_id} with their bank.`}
      </Text>
      <Text style={styles.p}>
        {d.due_by
          ? `Stripe has taken the amount back while the bank decides. Submit evidence in the Stripe dashboard by ${d.due_by}, or the money is lost.`
          : "Stripe has taken the amount back while the bank decides. Check the response deadline in the Stripe dashboard and submit evidence before it."}
      </Text>
      {row("Order", `#${d.display_id}`)}
      {row("Amount", formatPence(d.amount_pence))}
      {row("Reason given", d.reason.replace(/_/g, " "))}
      {row("Status", d.status.replace(/_/g, " "))}
      {d.due_by ? row("Respond by", d.due_by) : null}
      <Text style={{ ...styles.p, marginTop: "16px" }}>
        {"Don't refund this order from the admin while the dispute is open: a refund on top of a dispute pays the customer twice."}
      </Text>
      <Button href={d.dispute_url} style={styles.button}>
        Open the dispute in Stripe
      </Button>
      <Text style={{ ...styles.p, marginTop: "16px" }}>
        <Link href={d.admin_order_url} style={styles.link}>
          View the order in the admin
        </Link>
      </Text>
    </Layout>
  )
}
