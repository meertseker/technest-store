import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"
import { BRAND, storefrontUrl } from "../brand"

const font = "Inter, Helvetica, Arial, sans-serif"

export const styles = {
  p: { fontSize: "16px", lineHeight: "24px", color: BRAND.text, margin: "0 0 16px" },
  muted: { fontSize: "14px", lineHeight: "20px", color: BRAND.muted, margin: "0 0 8px" },
  link: { color: BRAND.text, textDecoration: "underline" },
  button: {
    backgroundColor: BRAND.accent,
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: 600,
    padding: "12px 20px",
    borderRadius: "6px",
    textDecoration: "none",
    display: "inline-block",
  },
}

export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  const site = storefrontUrl()
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#F9FAFB", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container
          style={{ backgroundColor: "#FFFFFF", maxWidth: "600px", borderTop: `4px solid ${BRAND.accent}` }}
        >
          <Section style={{ padding: "24px 24px 8px" }}>
            <Link href={site} style={{ fontSize: "24px", fontWeight: 700, color: BRAND.text, textDecoration: "none" }}>
              Tech <span style={{ color: BRAND.accent }}>Nest</span>
            </Link>
          </Section>
          <Section style={{ padding: "8px 24px 16px" }}>{children}</Section>
          <Hr style={{ borderColor: BRAND.border, margin: 0 }} />
          <Section style={{ padding: "16px 24px 24px" }}>
            <Text style={styles.muted}>{`${BRAND.legalName} · ${BRAND.address}`}</Text>
            <Text style={styles.muted}>
              Call {BRAND.phone} · <Link href={`mailto:${BRAND.email}`} style={styles.link}>{BRAND.email}</Link> ·{" "}
              <Link href={`${site}/returns`} style={styles.link}>Returns</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
