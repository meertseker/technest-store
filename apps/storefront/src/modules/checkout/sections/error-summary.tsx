"use client"

import { useEffect, useRef } from "react"
import type { FieldError } from "@lib/checkout/validate"

/**
 * Error summary (spec 8): role="alert", tabindex=-1, "There is a problem",
 * each item links to its field. Focus moves here once per failed submit
 * (keyed on `submission`), never on blur.
 */
export default function ErrorSummary({
  errors,
  submission,
  fieldId,
}: {
  errors: FieldError[]
  submission: number
  fieldId: (field: string) => string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (errors.length && submission) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission])

  if (!errors.length) return null

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="mb-6 rounded border-2 border-destructive p-4 outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ring"
      data-testid="error-summary"
    >
      <h3 id="error-summary-title" className="text-lg font-semibold">
        There is a problem
      </h3>
      <ul className="mt-2 flex flex-col gap-1">
        {errors.map((e) => (
          <li key={e.field}>
            <a
              href={`#${fieldId(e.field)}`}
              className="inline-flex min-h-11 items-center font-semibold text-destructive underline underline-offset-4"
              onClick={(ev) => {
                const el = document.getElementById(fieldId(e.field))
                if (el) {
                  ev.preventDefault()
                  el.focus()
                  el.scrollIntoView({ block: "center" })
                }
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
