import { Spinner } from "@medusajs/icons"
import { Button, Prompt, Text, clx } from "@medusajs/ui"
import { ReactNode } from "react"

// Small building blocks shared by the Tech Nest admin pages. The owner uses the
// admin on a phone, so every primary action is at least 44px tall (min-h-11)
// and body text uses Text size="large" (16px).

export const TAP = "min-h-11"

/** Small product picture (decorative: the title is always next to it). */
export function Thumb({ src }: { src: string | null | undefined }) {
  return (
    <span className="bg-ui-bg-subtle shadow-elevation-card-rest flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  )
}

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10" role="status">
      <Spinner className="animate-spin" />
      <Text size="large" className="text-ui-fg-subtle">
        {label}
      </Text>
    </div>
  )
}

export type FilterOption<T extends string> = { value: T; label: string; count?: number }

/** A row of toggle buttons ("Pending", "Approved", ...). Wraps on small screens. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          variant={o.value === value ? "primary" : "secondary"}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={TAP}
        >
          {o.count === undefined ? o.label : `${o.label} (${o.count})`}
        </Button>
      ))}
    </div>
  )
}

/** "Showing 21-40 of 45" with Previous / Next buttons. Hidden when one page is enough. */
export function Pager({
  offset,
  limit,
  count,
  onChange,
}: {
  offset: number
  limit: number
  count: number
  onChange: (offset: number) => void
}) {
  if (count <= limit && offset === 0) return null
  const from = count ? offset + 1 : 0
  const to = Math.min(offset + limit, count)
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 md:px-6"
      aria-label="Pages"
    >
      <Text size="large" className="text-ui-fg-subtle">
        Showing {from}–{to} of {count}
      </Text>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className={TAP}
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={TAP}
          disabled={offset + limit >= count}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}

/** Label/value pair for detail pages. Stacks on phones, two columns from `sm`. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[200px_1fr] sm:items-baseline sm:gap-4 md:px-6">
      <Text size="large" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      <div className="min-w-0 break-words">
        {typeof children === "string" || typeof children === "number" ? (
          <Text size="large">{children}</Text>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

/**
 * Confirm dialog with large buttons. `usePrompt` from @medusajs/ui only has
 * small (28px) buttons, which are too small to tap reliably on a phone.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  variant = "confirmation",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmText: string
  cancelText?: string
  variant?: "confirmation" | "danger"
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Prompt open={open} variant={variant} onOpenChange={(o) => !o && onCancel()}>
      <Prompt.Content className="w-[calc(100%-2rem)]">
        <Prompt.Header>
          <Prompt.Title>{title}</Prompt.Title>
          <Prompt.Description className="txt-medium">{description}</Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer className="flex-col-reverse gap-2 sm:flex-row">
          <Prompt.Cancel className={clx(TAP, "w-full sm:w-auto")} onClick={onCancel}>
            {cancelText}
          </Prompt.Cancel>
          <Prompt.Action className={clx(TAP, "w-full sm:w-auto")} onClick={onConfirm}>
            {confirmText}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
