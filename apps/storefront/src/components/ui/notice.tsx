import { CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Success / information banner. `role="status"` so a message that appears
 * after an action (e.g. "Address saved") is announced without moving focus.
 */
export default function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success"
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const Icon = tone === "success" ? CheckCircle2 : Info
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded border p-4",
        tone === "success" ? "border-success bg-success-subtle" : "border-border bg-surface",
        className
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-6 shrink-0", tone === "success" ? "text-success" : "text-muted-foreground")} />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
      </div>
    </div>
  )
}
