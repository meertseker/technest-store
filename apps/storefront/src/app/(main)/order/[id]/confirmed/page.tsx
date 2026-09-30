import { retrieveOrder } from "@lib/data/orders"
import { retrieveCustomer } from "@lib/data/customer"
import OrderConfirmedTemplate from "@modules/order/templates/order-confirmed-template"
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

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const [order, customer] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer(),
  ])

  if (!order) {
    return notFound()
  }

  return <OrderConfirmedTemplate order={order} isGuest={!customer} />
}
