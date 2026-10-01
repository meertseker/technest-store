"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { announceAddedToBasket } from "@lib/basket/events"
import { addToCart } from "@lib/data/cart"
import { STORE_COUNTRY } from "@lib/constants/store"

export type AddState = "idle" | "pending" | "added" | "error"

/**
 * Adds a variant with the existing cart server action (lib/data/cart.ts), then
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
      try {
        await addToCart({ variantId, quantity, countryCode: STORE_COUNTRY })
        setState("added")
        announceAddedToBasket()
        startTransition(() => router.refresh())
        timer.current = window.setTimeout(() => setState("idle"), 4000)
      } catch (e) {
        setState("error")
        // Medusa's messages are shopper-safe ("... is out of stock"); never log them with ids
        const message = e instanceof Error && e.message ? e.message : ""
        setError(
          /stock|inventory/i.test(message)
            ? "Sorry, there isn't enough stock for that quantity."
            : "We couldn't add this to your basket. Please try again."
        )
      }
    },
    [router]
  )

  return { add, state, error }
}
