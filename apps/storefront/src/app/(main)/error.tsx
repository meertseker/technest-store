"use client"

import { Button } from "@/components/ui/button"

/** Keeps the header and footer when a page fails (e.g. the backend is down) */
export default function MainError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="content-container py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
        We couldn&apos;t load this page. Please try again, or call the shop if it
        keeps happening.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
