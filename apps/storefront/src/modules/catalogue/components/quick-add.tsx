"use client"

import { Check, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAddToBasket } from "./use-add-to-basket"

/**
 * The card's "Add" button (docs/specs/design.md 4), only for products with a
 * single variant in stock: anything with choices links to its product page.
 */
export default function QuickAdd({ variantId, title }: { variantId: string; title: string }) {
  const { add, state, error } = useAddToBasket()
  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full"
        aria-label={`Add ${title} to basket`}
        disabled={state === "pending"}
        onClick={() => add(variantId, 1)}
      >
        {state === "pending" ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : state === "added" ? (
          <Check aria-hidden />
        ) : (
          <Plus aria-hidden />
        )}
        {state === "added" ? "Added" : "Add"}
      </Button>
      <p role="status" className="sr-only">
        {state === "added" ? `${title} added to your basket` : ""}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
