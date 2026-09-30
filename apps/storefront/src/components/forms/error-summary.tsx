"use client"

import { useEffect, useRef } from "react"
import type { FieldErrors } from "@/lib/forms/validation"

type Props = {
  errors: FieldErrors
  formError?: string
  /** A new object on every failed submit: focus moves here once per submit */
  trigger: unknown
  /** Field order on the page, so the list reads top to bottom */
  order?: readonly string[]
}

/**
 * Spec 8 / GOV.UK error summary: role="alert", tabindex="-1", heading
 * "There is a problem", each item links to its field. Focus moves to it once
 * per failed submit (never on blur).
 */
export default function ErrorSummary({ errors, formError, trigger, order }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const names = Object.keys(errors).sort((a, b) => rank(order, a) - rank(order, b))
  const show = names.length > 0 || !!formError

  useEffect(() => {
    if (show) ref.current?.focus()
  }, [trigger, show])

  if (!show) return null

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="mb-8 rounded border-[3px] border-destructive bg-background p-4 outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
      data-testid="error-summary"
    >
      <h2 id="error-summary-title" className="text-[22px] font-semibold leading-tight">
        There is a problem
      </h2>
      {formError && <p className="mt-2">{formError}</p>}
      {names.length > 0 && (
        <ul className="mt-2">
          {names.map((name) => (
            <li key={name}>
              <a
                href={`#${name}`}
                onClick={(e) => {
                  const el = document.getElementById(name)
                  if (el) {
                    e.preventDefault()
                    el.focus()
                    el.scrollIntoView({ block: "center" })
                  }
                }}
                className="inline-flex min-h-11 items-center font-semibold text-destructive underline underline-offset-4 hover:decoration-2"
              >
                {errors[name]}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function rank(order: readonly string[] | undefined, name: string) {
  const i = order?.indexOf(name) ?? -1
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}
