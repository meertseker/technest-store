import { retrieveCart } from "@lib/data/cart"
import { getBasketView } from "@lib/data/basket"
import BasketDrawer from "@modules/basket/components/basket-drawer"

/** Header basket: server-fetched cart + delivery facts, rendered into the client drawer */
export default async function CartButton() {
  const cart = await retrieveCart().catch(() => null)
  const view = await getBasketView(cart)

  return <BasketDrawer cart={cart} view={view} />
}
