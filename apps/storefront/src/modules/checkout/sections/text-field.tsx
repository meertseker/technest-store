import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Input per spec 4: 48px, 16px text, label above (never placeholder-only),
 * error text below with an icon, linked with aria-describedby.
 */
export default function TextField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-semibold">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-base text-muted-foreground">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "h-12 w-full rounded border bg-background px-3 text-base text-foreground",
          error ? "border-2 border-destructive" : "border-border-strong"
        )}
        {...input}
      />
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-base font-medium text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
    </div>
  )
}
