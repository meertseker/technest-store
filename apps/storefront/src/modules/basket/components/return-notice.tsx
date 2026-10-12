import { AlertCircle, Info } from "lucide-react"
import { PAYMENT_PROCESSING } from "@modules/checkout/payment/helpers"

/**
 * The outcome of a payment return for a basket that is not the visitor's own
 * (/api/payment-return sends them here with `?error=`). A payment the bank is
 * still deciding is not a failure: it is a calm status, not a red alert.
 */
const NOTICES: Record<string, { tone: "error" | "status"; text: string }> = {
  payment_failed: {
    tone: "error",
    text: "Your payment didn't go through, so you haven't been charged. Please try again.",
  },
  order_failed: {
    tone: "error",
    text: "We couldn't place your order. You haven't been charged. Please try again or call the shop.",
  },
  processing: { tone: "status", text: PAYMENT_PROCESSING },
}

export default function ReturnNotice({ code }: { code: string | undefined }) {
  const notice = code ? NOTICES[code] : undefined
  if (!notice) return null
  if (notice.tone === "status") {
    return (
      <div
        role="status"
        className="mt-4 flex gap-3 rounded-lg border border-border bg-surface p-3 text-base"
        data-testid="basket-return-status"
      >
        <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>{notice.text}</p>
      </div>
    )
  }
  return (
    <div
      role="alert"
      className="mt-4 flex gap-3 rounded-lg border border-destructive p-3 text-base"
      data-testid="basket-return-error"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
      <p>{notice.text}</p>
    </div>
  )
}
