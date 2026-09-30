import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "success" | "warning"

const TONES: Record<StatusTone, { cls: string; Icon: typeof Clock }> = {
  neutral: { cls: "bg-surface-2 text-foreground", Icon: Clock },
  success: { cls: "bg-success-subtle text-success", Icon: CheckCircle2 },
  warning: { cls: "bg-warning-subtle text-warning", Icon: AlertTriangle },
}

/** Pill badge; colour never carries the meaning alone (icon + words) */
export default function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  const { cls, Icon } = TONES[tone]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", cls, className)} data-small-text>
      <Icon aria-hidden className="size-4" />
      {children}
    </span>
  )
}
