import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { PageTabs } from "../../components/page-tabs"
import { AddProduct } from "../../components/products/add-product"
import { ImportProducts } from "../../components/products/import-products"
import { PriceStock } from "../../components/products/price-stock"
import { useUrlTab } from "../../lib/tabs"

// The Products page: add one (photo or typed), change a price or stock, or
// import many. The open tab is in the URL (?tab=).

const TABS = [
  { value: "add", label: "Add" },
  { value: "stock", label: "Price & stock" },
  { value: "import", label: "Import" },
] as const
type Tab = (typeof TABS)[number]["value"]
const TAB_VALUES = TABS.map((t) => t.value)

const ShopProductsPage = () => {
  const [tab, setTab] = useUrlTab<Tab>(TAB_VALUES, "add")
  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-1 px-4 py-4 md:px-6">
        <Heading level="h1">Products</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Add one, change a price or stock, or import many.
        </Text>
      </Container>
      <PageTabs tabs={TABS} value={tab} onChange={setTab}>
        {{
          add: <AddProduct />,
          stock: <PriceStock />,
          import: <ImportProducts />,
        }}
      </PageTabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Products",
  icon: Tag,
  rank: 2,
})

export default ShopProductsPage
