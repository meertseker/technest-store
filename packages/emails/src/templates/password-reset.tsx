import { Button, Text } from "@react-email/components"
import { BRAND } from "../brand"
import { Layout, styles } from "../components/layout"

export type PasswordResetData = {
  /** Full link including the one-time token. */
  reset_url: string
  actor: "customer" | "staff"
}

export const subject = (d: PasswordResetData) =>
  d.actor === "staff" ? "Reset your Tech Nest admin password" : "Reset your Tech Nest password"

// The link carries a live token: only ever render http(s) links, https outside localhost.
function assertSafeUrl(url: string) {
  const u = new URL(url)
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1"
  if (!(u.protocol === "https:" || (local && u.protocol === "http:"))) {
    throw new Error("password-reset: reset_url must be an https link")
  }
}

export function Email(d: PasswordResetData) {
  try {
    assertSafeUrl(d.reset_url)
  } catch {
    throw new Error("password-reset: reset_url must be an https link")
  }
  return (
    <Layout preview="Reset your password (link valid for 15 minutes)">
      <Text style={styles.p}>
        {d.actor === "staff"
          ? "Someone asked to reset the password for your Tech Nest admin account."
          : "Someone asked to reset the password for your Tech Nest account."}
      </Text>
      <Button href={d.reset_url} style={styles.button}>
        Choose a new password
      </Button>
      <Text style={{ ...styles.p, marginTop: "16px" }}>
        {`This link works once and expires in 15 minutes. If the button doesn't work, copy this link into your browser: ${d.reset_url}`}
      </Text>
      <Text style={styles.muted}>
        {`If you didn't ask for this, you can ignore this email: your password won't change. Worried? Call us on ${BRAND.phone}.`}
      </Text>
    </Layout>
  )
}
