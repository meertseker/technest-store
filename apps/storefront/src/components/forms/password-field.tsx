"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { describedBy, FieldError, FieldHint, FieldLabel, inputClass } from "./field"

type Props = {
  name: string
  label: string
  hint?: string
  error?: string
  autoComplete: "current-password" | "new-password"
}

/**
 * Password input with a Show/Hide toggle (ux: password visibility). Paste and
 * password managers are never blocked (WCAG 2.2 3.3.8 accessible authentication).
 */
export default function PasswordField({ name, label, hint, error, autoComplete }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-col">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {hint && <FieldHint id={`${name}-hint`}>{hint}</FieldHint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
      <div className="mt-2 flex gap-2">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, hint, error)}
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={name}
          className="inline-flex min-h-12 min-w-[88px] cursor-pointer items-center justify-center gap-2 rounded border border-border-strong bg-background px-3 font-semibold transition-colors duration-150 hover:bg-surface"
        >
          {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          {visible ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      </div>
    </div>
  )
}
