import { Metadata } from "next"
import { declineTransferRequest } from "@lib/data/orders"
import { TransferOutcome, TransferShell } from "@modules/order/components/transfer-result"

export const metadata: Metadata = {
  title: "Move an order",
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ id: string; token: string }> }

export default async function DeclineTransferPage({ params }: Props) {
  const { id, token } = await params
  const { success } = await declineTransferRequest(id, token)

  return (
    <TransferShell title={success ? "The order stays with you" : "We couldn't decline the request"}>
      <TransferOutcome success={success} done="The request was declined. Nothing has changed." />
    </TransferShell>
  )
}
