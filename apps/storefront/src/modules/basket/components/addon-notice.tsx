import { AlertTriangle } from "lucide-react"

/**
 * Amber add-on rule notice (spec 7.4, CLAUDE.md add-on rule).
 * Shown when the basket is only £1 add-ons, so delivery isn't possible.
 */
export default function AddonNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex gap-3 rounded border border-warning/40 bg-warning-subtle p-3 text-base text-foreground ${className}`}
      data-testid="addon-notice"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
      <p>
        <strong className="font-semibold">£1 items can&apos;t be delivered on their own.</strong> Add
        another item for delivery, or choose free Click &amp; Collect.
      </p>
    </div>
  )
}
