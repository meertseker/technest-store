import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type SectionState = "open" | "done" | "locked"

/**
 * One checkout section (spec 7.5): numbered heading; when done it collapses to a
 * summary with an "Edit" link. Edit is a plain link (?step=...), so it works
 * before hydration and keeps the browser back button meaningful.
 */
export default function StepSection({
  id,
  number,
  title,
  state,
  editHref,
  summary,
  children,
}: {
  id: string
  number: number
  title: string
  state: SectionState
  editHref?: string
  summary?: React.ReactNode
  children?: React.ReactNode
}) {
  const headingId = `${id}-heading`
  return (
    <section
      aria-labelledby={headingId}
      className={cn("border-b border-border py-6", state === "open" && "pb-8")}
      data-testid={`checkout-section-${id}`}
      data-state={state}
    >
      <div className="flex min-h-11 items-center justify-between gap-4">
        <h2
          id={headingId}
          className={cn(
            "flex items-center gap-3 text-[22px] font-semibold leading-tight lg:text-[28px]",
            state === "locked" && "text-muted-foreground"
          )}
        >
          {state === "done" ? (
            <CheckCircle2 aria-hidden className="size-7 shrink-0 text-success" />
          ) : (
            <span
              aria-hidden
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-base font-bold",
                state === "open" ? "bg-foreground text-background" : "border border-border-strong"
              )}
            >
              {number}
            </span>
          )}
          <span>
            <span className="sr-only">Step {number} of 3: </span>
            {title}
            {state === "done" && <span className="sr-only"> (complete)</span>}
          </span>
        </h2>
        {state === "done" && editHref && (
          <a
            href={editHref}
            className="inline-flex min-h-11 items-center px-2 font-semibold underline underline-offset-4 hover:decoration-2"
            data-testid={`edit-${id}`}
          >
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </a>
        )}
      </div>
      {state === "done" && summary && (
        <div className="mt-3 pl-10 text-base text-muted-foreground" data-testid={`summary-${id}`}>
          {summary}
        </div>
      )}
      {state === "open" && <div className="mt-6">{children}</div>}
    </section>
  )
}
