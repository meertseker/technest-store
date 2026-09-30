import { Button, Text } from "@react-email/components"
import type { OrderLine } from "../order-types"
import { styles } from "./layout"

export const Greeting = ({ first_name }: { first_name?: string | null }) => (
  <Text style={styles.p}>{`Hi ${first_name || "there"},`}</Text>
)

export const Lines = ({ items }: { items: OrderLine[] }) => (
  <>
    {items.map((i, n) => (
      <Text key={n} style={{ ...styles.p, margin: "0 0 8px" }}>
        {`${i.quantity} × ${i.title}${i.variant_title ? ` (${i.variant_title})` : ""}`}
      </Text>
    ))}
  </>
)

export const OrderButton = ({ href }: { href: string }) => (
  <Button href={href} style={styles.button}>
    View your order
  </Button>
)
