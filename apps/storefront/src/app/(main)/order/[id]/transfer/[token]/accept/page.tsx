import { Metadata } from "next"
import { acceptTransferRequest } from "@lib/data/orders"
import { TransferOutcome, TransferShell } from "@modules/order/components/transfer-result"

export const metadata: Metadata = {
  title: "Move an order",
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ id: string; token: string }> }

export default async function AcceptTransferPage({ params }: Props) {
  const { id, token } = await params
  const { success } = await acceptTransferRequest(id, token)

  return (
    <TransferShell title={success ? "The order has been moved" : "We couldn't move the order"}>
      <TransferOutcome success={success} done="It now shows in the other account." />
    </TransferShell>
  )
}
