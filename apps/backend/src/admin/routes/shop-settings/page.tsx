import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CogSixTooth } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { PageTabs } from "../../components/page-tabs"
import { Devices } from "../../components/settings/devices"
import { Thresholds } from "../../components/settings/thresholds"
import { useUrlTab } from "../../lib/tabs"

// Shop settings: the few numbers the owner changes (free delivery and Klarna
// thresholds) and the list of phone models. The open tab is in the URL (?tab=).

const TABS = [
  { value: "thresholds", label: "Delivery & Klarna" },
  { value: "devices", label: "Devices" },
] as const
type Tab = (typeof TABS)[number]["value"]
const TAB_VALUES = TABS.map((t) => t.value)

const ShopSettingsPage = () => {
  const [tab, setTab] = useUrlTab<Tab>(TAB_VALUES, "thresholds")
  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-1 px-4 py-4 md:px-6">
        <Heading level="h1">Shop settings</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Delivery and Klarna amounts, and the phones the shop sells for.
        </Text>
      </Container>
      <PageTabs tabs={TABS} value={tab} onChange={setTab}>
        {{ thresholds: <Thresholds />, devices: <Devices /> }}
      </PageTabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Shop settings",
  icon: CogSixTooth,
  rank: 3,
})

export default ShopSettingsPage
