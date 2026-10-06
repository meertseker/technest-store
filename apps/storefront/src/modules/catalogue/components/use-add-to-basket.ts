"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { announceAddedToBasket } from "@lib/basket/events"
import { addToBasket } from "@lib/data/basket-actions"

export type AddState = "idle" | "pending" | "added" | "error"

/**
 * Adds a variant with the basket server action (lib/data/basket-actions.ts), then
 * refreshes the server components so the header basket count updates, and
 * announces it so the header opens the basket drawer, which shows "Added to
 * basket" at the top (spec 7.4). The shopper stays on the page. "added" falls back to idle
 * after a few seconds.
 */
export function useAddToBasket() {
  const router = useRouter()
  const [state, setState] = useState<AddState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const add = useCallback(
    async (variantId: string, quantity: number) => {
      window.clearTimeout(timer.current)
      setState("pending")
      setError(null)
      // the action reports its outcome; a rejection means the request itself failed
      const result = await addToBasket({ variantId, quantity }).catch(() => ({ ok: false, reason: "error" }) as const)
      if (result.ok) {
        setState("added")
        announceAddedToBasket()
        startTransition(() => router.refresh())
        timer.current = window.setTimeout(() => setState("idle"), 4000)
      } else {
        setState("error")
        setError(
          result.reason === "stock"
            ? "Sorry, there isn't enough stock for that quantity."
            : "We couldn't add this to your basket. Please try again."
        )
      }
    },
    [router]
  )

  return { add, state, error }
}
