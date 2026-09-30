import { hasAnalyticsConsent } from "@/lib/consent/server"

/**
 * Wrap any analytics script in this. Nothing inside renders (so no script is
 * even in the HTML) until the visitor has pressed "Accept". Never use it on
 * /checkout, where only Stripe's script is allowed.
 */
export default async function WithAnalyticsConsent({ children }: { children: React.ReactNode }) {
  return (await hasAnalyticsConsent()) ? <>{children}</> : null
}
