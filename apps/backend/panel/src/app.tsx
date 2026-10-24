import { Container, Heading, Text } from "@medusajs/ui"
import { useEffect } from "react"
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom"
import RepairBookingsMoved from "../../src/admin/routes/repair-bookings/page"
import RepairBookingPage from "../../src/admin/routes/repair-bookings/[id]/page"
import ShopProductsPage from "../../src/admin/routes/shop-products/page"
import ShopSettingsPage from "../../src/admin/routes/shop-settings/page"
import TradeApplicationsMoved from "../../src/admin/routes/trade-applications/page"
import TradeApplicationPage from "../../src/admin/routes/trade-applications/[id]/page"
import { RequireSignIn } from "./auth"
import { OrdersPage } from "./pages/all-orders"
import { AllProductsPage } from "./pages/all-products"
import { CustomerPage, CustomersPage } from "./pages/customers"
import { OrderPage } from "./pages/order"
import { ProductPage } from "./pages/product"
import { ResetPasswordPage } from "./pages/reset-password"
import { SalesPage } from "./pages/sales"
import { Shell } from "./shell"

// The panel uses the same paths as the shop's pages in Medusa's dashboard, so the
// reused screens' links (/orders/:id, /products/:id, /customers/:id,
// /shop-orders?tab=…) and the shop's emails (ADMIN_URL/orders/:id, …/inventory)
// land on the panel's own pages. Nothing here leads to Medusa's dashboard.

function NotFound() {
  return (
    <Container className="flex flex-col gap-2 px-4 py-6 md:px-6">
      <Heading level="h1">Page not found</Heading>
      <Text size="large">
        <Link to="/sales" className="text-ui-fg-interactive underline">
          Go to Sales
        </Link>
      </Text>
    </Container>
  )
}

/** A new page starts at the top, as on a normal site. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function SignedIn() {
  return (
    <RequireSignIn>
      {(me) => (
        <Shell me={me}>
          <Routes>
            <Route path="/" element={<Navigate to="/sales" replace />} />
            {/* Today was removed (lead, 2026-10-24); old bookmarks land on Sales. */}
            <Route path="/today" element={<Navigate to="/sales" replace />} />
            <Route path="/shop-orders" element={<OrdersPage />} />
            <Route path="/orders" element={<Navigate to="/shop-orders?tab=all" replace />} />
            <Route path="/orders/:id" element={<OrderPage />} />
            <Route path="/shop-products" element={<ShopProductsPage />} />
            <Route path="/products" element={<AllProductsPage />} />
            <Route path="/products/:id" element={<ProductPage />} />
            <Route path="/inventory" element={<Navigate to="/shop-products?tab=stock" replace />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/shop-settings" element={<ShopSettingsPage />} />
            <Route path="/repair-bookings" element={<RepairBookingsMoved />} />
            <Route path="/repair-bookings/:id" element={<RepairBookingPage />} />
            <Route path="/trade-applications" element={<TradeApplicationsMoved />} />
            <Route path="/trade-applications/:id" element={<TradeApplicationPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Shell>
      )}
    </RequireSignIn>
  )
}

export function App() {
  return (
    <BrowserRouter basename="/panel">
      <ScrollToTop />
      <Routes>
        {/* Reached from the reset email, before signing in. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<SignedIn />} />
      </Routes>
    </BrowserRouter>
  )
}
