"use client"

import { Loader2 } from "lucide-react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

export default function SubmitButton({
  children,
  "data-testid": testId,
}: {
  children: React.ReactNode
  "data-testid"?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="w-full md:w-auto" data-testid={testId}>
      {pending && <Loader2 aria-hidden className="animate-spin" />}
      {children}
    </Button>
  )
}
