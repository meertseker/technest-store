import { Container, Heading, Text } from "@medusajs/ui"
import { useEffect } from "react"
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom"
import RepairBookingsMoved from "../../src/admin/routes/repair-bookings/page"
import RepairBookingPage from "../../src/admin/routes/repair-bookings/[id]/page"
import ShopOrdersPage from "../../src/admin/routes/shop-orders/page"
import ShopProductsPage from "../../src/admin/routes/shop-products/page"
import ShopSettingsPage from "../../src/admin/routes/shop-settings/page"
import TodayPage from "../../src/admin/routes/today/page"
import TradeApplicationsMoved from "../../src/admin/routes/trade-applications/page"
import TradeApplicationPage from "../../src/admin/routes/trade-applications/[id]/page"
import { RequireSignIn } from "./auth"
import { AllOrdersPage } from "./pages/all-orders"
import { AllProductsPage } from "./pages/all-products"
import { OrderPage } from "./pages/order"
import { ProductPage } from "./pages/product"
import { Shell } from "./shell"

// The panel uses the same paths as the shop's pages in Medusa's dashboard, so the
// reused screens' links (/orders/:id, /products/:id, /shop-orders?tab=…) land on
// the panel's own pages instead of Medusa's.

/** Customer records stay in Medusa's dashboard (trade pages link to them). */
function CustomerRedirect() {
  const { id } = useParams<{ id: string }>()
  useEffect(() => {
    window.location.assign(`/app/customers/${encodeURIComponent(id ?? "")}`)
  }, [id])
  return <Text size="large">Opening the customer in the full admin…</Text>
}

function NotFound() {
  return (
    <Container className="flex flex-col gap-2 px-4 py-6 md:px-6">
      <Heading level="h1">Page not found</Heading>
      <Text size="large">
        <Link to="/today" className="text-ui-fg-interactive underline">
          Go to Today
        </Link>
      </Text>
    </Container>
  )
}

/** A new page starts at the top and its title is read out, as on a normal site. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App() {
  return (
    <BrowserRouter basename="/panel">
      <ScrollToTop />
      <RequireSignIn>
        {(me) => (
          <Shell me={me}>
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/shop-orders" element={<ShopOrdersPage />} />
              <Route path="/shop-products" element={<ShopProductsPage />} />
              <Route path="/shop-settings" element={<ShopSettingsPage />} />
              <Route path="/orders" element={<AllOrdersPage />} />
              <Route path="/orders/:id" element={<OrderPage />} />
              <Route path="/products" element={<AllProductsPage />} />
              <Route path="/products/:id" element={<ProductPage />} />
              <Route path="/repair-bookings" element={<RepairBookingsMoved />} />
              <Route path="/repair-bookings/:id" element={<RepairBookingPage />} />
              <Route path="/trade-applications" element={<TradeApplicationsMoved />} />
              <Route path="/trade-applications/:id" element={<TradeApplicationPage />} />
              <Route path="/customers/:id" element={<CustomerRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Shell>
        )}
      </RequireSignIn>
    </BrowserRouter>
  )
}
