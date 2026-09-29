import { Button, Text } from "@react-email/components"
import { storefrontUrl } from "../brand"
import { Layout, styles } from "../components/layout"

export type WelcomeData = { first_name?: string | null }

export const subject = (_: WelcomeData) => "Welcome to Tech Nest"

export function Email({ first_name }: WelcomeData) {
  return (
    <Layout preview="Your Tech Nest account is ready">
      <Text style={styles.p}>{`Hi ${first_name || "there"},`}</Text>
      <Text style={styles.p}>
        Thanks for creating an account. Pick your phone or console once and we will only show you
        accessories that fit it.
      </Text>
      <Button href={`${storefrontUrl()}/account`} style={styles.button}>
        Go to your account
      </Button>
    </Layout>
  )
}
