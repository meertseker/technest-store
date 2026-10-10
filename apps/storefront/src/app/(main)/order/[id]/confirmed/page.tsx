import { getRecentOrderId } from "@lib/data/cookies"
import { retrieveOrder } from "@lib/data/orders"
import { retrieveCustomer } from "@lib/data/customer"
import OrderConfirmedTemplate from "@modules/order/templates/order-confirmed-template"
import OrderReceivedTemplate from "@modules/order/templates/order-received-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Order placed",
  robots: { index: false },
}

// Shows "today's hours" and a per-visitor account offer
export const dynamic = "force-dynamic"

/**
 * The order id is in the URL (and in the confirmation email), so having it is
 * not proof of owning the order. The full page, with the email address and the
 * delivery address, is for the browser that just placed it (cookie) or the
 * signed-in owner; anyone else sees the order number and where the details went.
 */
export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const [order, customer, recentOrderId] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer(),
    getRecentOrderId(),
  ])

  if (!order) {
    return notFound()
  }

  const justPlaced = recentOrderId === order.id
  const isOwner = !!customer && !!order.customer_id && order.customer_id === customer.id
  if (!justPlaced && !isOwner) {
    return <OrderReceivedTemplate displayId={order.display_id} />
  }

  return <OrderConfirmedTemplate order={order} isGuest={!customer} ownerLink={isOwner} />
}
