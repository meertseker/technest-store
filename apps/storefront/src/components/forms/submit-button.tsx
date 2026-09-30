"use client"

import { Loader2 } from "lucide-react"
import { useFormStatus } from "react-dom"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Primary submit button, full width on mobile (spec 4). While the action runs
 * it stays focusable, shows a spinner and says what is happening, and a second
 * click is ignored (aria-disabled rather than disabled keeps focus in place).
 */
export default function SubmitButton({
  children,
  pendingText = "Sending…",
  className,
  variant = "primary",
  pending: pendingProp,
  ...rest
}: ButtonProps & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus()
  const pending = pendingProp ?? status.pending
  return (
    <Button
      type="submit"
      variant={variant}
      aria-disabled={pending || undefined}
      onClick={(e) => {
        if (pending) e.preventDefault()
      }}
      className={cn("w-full sm:w-auto", pending && "cursor-wait", className)}
      {...rest}
    >
      {pending && <Loader2 aria-hidden className="animate-spin" />}
      {pending ? pendingText : children}
    </Button>
  )
}
