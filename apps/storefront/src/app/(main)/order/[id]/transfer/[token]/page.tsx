import { Metadata } from "next"
import TransferActions from "@modules/order/components/transfer-actions"
import { TransferShell } from "@modules/order/components/transfer-result"

export const metadata: Metadata = {
  title: "Move an order",
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ id: string; token: string }> }

/** The page behind the link in a "move this order to another account" email */
export default async function TransferPage({ params }: Props) {
  const { id, token } = await params

  return (
    <TransferShell title="Move this order to another account?">
      <p className="mt-4 max-w-[68ch]">
        Someone asked to move one of your orders to their Tech Nest account. If you agree, the
        order will show in their account instead of yours.
      </p>
      <p className="mt-3 max-w-[68ch] text-muted-foreground">
        If you do not recognise this request, choose No. Nothing changes.
      </p>
      <TransferActions id={id} token={token} />
    </TransferShell>
  )
}
