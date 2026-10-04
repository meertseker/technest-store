import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { retrieveCart } from "@lib/data/cart"
import { getBasketView } from "@lib/data/basket"
import BasketDrawer from "@modules/basket/components/basket-drawer"

/**
 * Header basket: server-fetched cart + delivery facts, rendered into the client drawer.
 * Rendered without a Suspense boundary (see the note in templates/nav), so it must
 * never throw: if the basket data can't be built, the header shows a plain link.
 * Next's own control-flow errors (redirect, dynamic rendering) still pass through.
 */
export default async function CartButton() {
  let data: { cart: Awaited<ReturnType<typeof retrieveCart>>; view: Awaited<ReturnType<typeof getBasketView>> } | null
  try {
    const cart = await retrieveCart().catch(() => null)
    data = { cart, view: await getBasketView(cart) }
  } catch (error) {
    unstable_rethrow(error)
    data = null
  }

  if (!data) {
    return (
      <Link href="/basket" className="inline-flex min-h-11 items-center px-2">
        Basket
      </Link>
    )
  }
  return <BasketDrawer cart={data.cart} view={data.view} />
}
