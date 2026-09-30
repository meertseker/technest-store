import { CheckCircle2, Truck } from "lucide-react"
import { freeDeliveryProgress } from "@lib/basket/free-delivery"
import { formatPenceExact } from "@lib/basket/money"

/**
 * "You're £3.50 away from free delivery" + progress bar (spec 7.4).
 * Red fill on a surface track; the text carries the meaning, so colour is never
 * the only cue. All amounts are integer pence.
 */
export default function FreeDeliveryBar({
  subtotal_pence,
  threshold_pence,
}: {
  subtotal_pence: number
  threshold_pence: number
}) {
  const p = freeDeliveryProgress(subtotal_pence, threshold_pence)
  const labelId = "free-delivery-label"

  return (
    <div className="flex flex-col gap-2" data-testid="free-delivery">
      <p id={labelId} className="flex items-center gap-2 text-base">
        {p.qualified ? (
          <>
            <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />
            <span>
              <strong className="font-semibold">Free standard delivery</strong> on this order
            </span>
          </>
        ) : (
          <>
            <Truck aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <span>
              You&apos;re <strong className="font-semibold tabular-nums">{formatPenceExact(p.remaining_pence)}</strong>{" "}
              away from free delivery
            </span>
          </>
        )}
      </p>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.percent}
        aria-valuetext={`${formatPenceExact(Math.min(subtotal_pence, threshold_pence))} of ${formatPenceExact(threshold_pence)}`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
          style={{ width: `${p.percent}%` }}
        />
      </div>
    </div>
  )
}
