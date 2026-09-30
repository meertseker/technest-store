"use client"

import { Minus, Plus } from "lucide-react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import {
  changeLineQuantity,
  removeLine,
  type LineActionState,
} from "@lib/data/basket-actions"
import { cn } from "@/lib/utils"

const INITIAL: LineActionState = { error: null, at: 0 }

const stepBtn =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded border border-border-strong bg-background text-foreground transition-colors duration-150 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"

function StepButton({
  value,
  label,
  disabled,
  children,
}: {
  value: number
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="quantity"
      value={value}
      aria-label={label}
      disabled={disabled || pending}
      className={stepBtn}
    >
      {children}
    </button>
  )
}

function Qty({ quantity }: { quantity: number }) {
  const { pending, data } = useFormStatus()
  // show the quantity being saved straight away
  const shown = pending && data?.get("quantity") ? Number(data.get("quantity")) : quantity
  return (
    <output
      aria-label="Quantity"
      className="min-w-8 text-center text-base font-semibold tabular-nums"
      aria-busy={pending}
    >
      {shown}
    </output>
  )
}

/**
 * Quantity stepper (44px buttons, 8px apart) and Remove, as form actions so they
 * work on /basket before JavaScript loads. The header's basket status region
 * announces the new count, so there is no second live region here.
 */
export default function LineControls({
  lineId,
  title,
  quantity,
  max = 99,
}: {
  lineId: string
  title: string
  quantity: number
  max?: number
}) {
  const [qtyState, qtyAction] = useActionState(changeLineQuantity, INITIAL)
  const [rmState, rmAction] = useActionState(removeLine, INITIAL)
  const error = (qtyState.at > rmState.at ? qtyState : rmState).error

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form action={qtyAction} className="flex items-center gap-2" data-testid="qty-stepper">
          <input type="hidden" name="line_id" value={lineId} />
          <StepButton value={quantity - 1} label={`Decrease quantity of ${title}`} disabled={quantity <= 1}>
            <Minus aria-hidden className="size-5" />
          </StepButton>
          <Qty quantity={quantity} />
          <StepButton value={quantity + 1} label={`Increase quantity of ${title}`} disabled={quantity >= max}>
            <Plus aria-hidden className="size-5" />
          </StepButton>
        </form>
        <form action={rmAction}>
          <input type="hidden" name="line_id" value={lineId} />
          <RemoveButton title={title} />
        </form>
      </div>
      {error && (
        <p role="alert" className="font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function RemoveButton({ title }: { title: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center px-1 text-base text-foreground underline underline-offset-4 transition-colors duration-150 hover:decoration-2 disabled:opacity-50"
      )}
      data-testid="remove-line"
    >
      {pending ? "Removing…" : "Remove"}
      <span className="sr-only"> {title}</span>
    </button>
  )
}
