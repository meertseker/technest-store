import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { Container, Heading, Text, clx } from "@medusajs/ui"
import { Link } from "react-router-dom"
import { PageTabs } from "../../components/page-tabs"
import { TAP } from "../../components/shop-ui"
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
      <Container className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Products</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            Add one, change a price or stock, or import many.
          </Text>
        </div>
        {/* Medusa's own list is off the menu; publishing, photos and export live there. */}
        <Link
          to="/products"
          className={clx(TAP, "text-ui-fg-interactive txt-large-plus inline-flex items-center underline-offset-2 hover:underline")}
        >
          All products
        </Link>
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
