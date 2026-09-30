"use client"

import Link from "next/link"
import { Check, CircleAlert, CircleCheck, Loader2, Minus, Plus, TriangleAlert } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { formatGbp } from "@/lib/home/select"
import {
  findVariant,
  isOnSale,
  maxQuantity,
  optionChoices,
  priceRange,
  stockLabel,
  stockState,
  variantOriginalPrice,
  variantPrice,
  type OptionLike,
  type Selected,
  type VariantLike,
} from "@/lib/catalogue/variants"
import { cn } from "@/lib/utils"
import { useAddToBasket } from "@modules/catalogue/components/use-add-to-basket"

export type BuyProduct = {
  id: string
  title: string
  options: OptionLike[]
  variants: VariantLike[]
}

type Props = {
  product: BuyProduct
  initial: Selected
  /** The fit box (server-rendered), shown between the price and the stock line */
  fitBox?: React.ReactNode
  /** "£1 items can't be delivered on their own" note for add-on items */
  addOnNote?: boolean
}

/**
 * The buy box (docs/specs/design.md 7.3): price inc. VAT, fit box, stock line,
 * variant buttons (44px), quantity stepper, Add to basket, and the sticky
 * mobile add bar that appears once the main button scrolls out of view.
 */
export default function BuyBox({ product, initial, fitBox, addOnNote }: Props) {
  const [selected, setSelected] = useState<Selected>(initial)
  const [qty, setQty] = useState(1)
  const [missing, setMissing] = useState(false)
  const { add, state, error } = useAddToBasket()
  const addRef = useRef<HTMLButtonElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [showBar, setShowBar] = useState(false)
  const uid = useId()

  const variant = useMemo(() => findVariant(product, selected), [product, selected])
  const choices = useMemo(() => optionChoices(product, selected), [product, selected])
  const range = priceRange(product)
  const stock = variant ? stockState(variant) : null
  const max = variant ? maxQuantity(variant) : 0
  const price = variant ? variantPrice(variant) : null
  const was = variant ? variantOriginalPrice(variant) : null
  const sale = variant ? isOnSale(variant) : false

  // Keep the quantity within what the chosen variant allows
  useEffect(() => {
    if (max > 0 && qty > max) setQty(max)
  }, [max, qty])

  // Shareable URL for the chosen variant, without a server round trip
  useEffect(() => {
    if (!variant || product.variants.length < 2) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("v_id") === variant.id) return
    url.searchParams.set("v_id", variant.id)
    window.history.replaceState(window.history.state, "", url)
  }, [variant, product.variants.length])

  // Sticky bar: shown once the main Add button has scrolled above the viewport
  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      const el = addRef.current
      if (el) setShowBar(el.getBoundingClientRect().bottom < 0)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  const choose = (optionId: string, value: string) => {
    setMissing(false)
    setSelected((s) => ({ ...s, [optionId]: value }))
  }

  const onAdd = () => {
    if (!variant) {
      setMissing(true)
      optionsRef.current?.scrollIntoView({ block: "center" })
      optionsRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()
      return
    }
    if (stock?.kind === "out") return
    add(variant.id, qty)
  }

  const priceText =
    price !== null
      ? formatGbp(price)
      : range
        ? `${range.min !== range.max ? "from " : ""}${formatGbp(range.min)}`
        : null
  const outOfStock = stock?.kind === "out"
  const pending = state === "pending"
  const addLabel = pending ? "Adding…" : state === "added" ? "Added to basket" : "Add to basket"
  const missingNames = choices.filter((c) => !selected[c.id]).map((c) => c.title.toLowerCase())

  return (
    <div>
      {/* Price */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {priceText ? (
          <p className="text-2xl font-bold tabular-nums lg:text-[28px]">
            {priceText}
            <span className="ml-2 text-base font-normal text-muted-foreground">inc. VAT</span>
          </p>
        ) : (
          <p className="text-muted-foreground">Price not available</p>
        )}
        {sale && was !== null && (
          <>
            <p className="text-muted-foreground tabular-nums">
              <span className="sr-only">Was </span>
              <s>{formatGbp(was)}</s>
            </p>
            <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-sm font-semibold text-brand">
              Sale
            </span>
          </>
        )}
      </div>

      {fitBox}

      {/* Stock */}
      <p className="mt-4 flex items-center gap-2" aria-live="polite">
        {!stock ? (
          <span className="text-muted-foreground">
            Choose {missingNames.join(" and ") || "an option"} to see stock
          </span>
        ) : stock.kind === "out" ? (
          <>
            <CircleAlert aria-hidden className="size-5 text-destructive" />
            <span className="font-semibold">{stockLabel(stock)}</span>
          </>
        ) : stock.kind === "low" ? (
          <>
            <TriangleAlert aria-hidden className="size-5 text-warning" />
            <span className="font-semibold text-warning">{stockLabel(stock)}</span>
          </>
        ) : (
          <>
            <CircleCheck aria-hidden className="size-5 text-success" />
            <span className="font-semibold text-success">{stockLabel(stock)}</span>
          </>
        )}
      </p>

      {/* Variants */}
      {choices.length > 0 && (
        <div ref={optionsRef} className="mt-4 space-y-4">
          {choices.map((c) => {
            const labelId = `${uid}-opt-${c.id}`
            return (
              <div key={c.id} role="group" aria-labelledby={labelId}>
                <p id={labelId} className="font-semibold">
                  {c.title}
                  {selected[c.id] && (
                    <span className="font-normal text-muted-foreground">: {selected[c.id]}</span>
                  )}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.values.map((v) => {
                    const on = selected[c.id] === v.value
                    const unavailable = !v.exists || !v.available
                    return (
                      <li key={v.value}>
                        <button
                          type="button"
                          aria-pressed={on}
                          disabled={!v.exists}
                          onClick={() => choose(c.id, v.value)}
                          className={cn(
                            "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border px-4 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
                            on
                              ? "border-2 border-foreground bg-surface font-semibold"
                              : "border-border-strong bg-background hover:bg-surface",
                            unavailable && "text-muted-foreground line-through"
                          )}
                        >
                          {v.value}
                          {unavailable && <span className="sr-only"> (out of stock)</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {missing && (
            <p role="alert" className="flex items-center gap-2 text-destructive">
              <CircleAlert aria-hidden className="size-5" />
              Please choose {missingNames.join(" and ")}.
            </p>
          )}
        </div>
      )}

      {/* Quantity + add */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="flex items-center rounded border border-border-strong">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            className="inline-flex size-11 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus aria-hidden className="size-5" />
            <span className="sr-only">Decrease quantity</span>
          </button>
          <label htmlFor={`${uid}-qty`} className="sr-only">
            Quantity
          </label>
          <input
            id={`${uid}-qty`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10)
              setQty(Number.isFinite(n) ? Math.min(Math.max(n, 1), Math.max(max, 1)) : 1)
            }}
            className="h-11 w-12 border-x border-border bg-background text-center text-base tabular-nums"
          />
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max || 1, q + 1))}
            disabled={!variant || qty >= max}
            className="inline-flex size-11 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus aria-hidden className="size-5" />
            <span className="sr-only">Increase quantity</span>
          </button>
        </div>
        <Button
          ref={addRef}
          type="button"
          onClick={onAdd}
          disabled={pending || outOfStock}
          className="min-w-0 flex-1 basis-48"
        >
          {pending ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : state === "added" ? (
            <Check aria-hidden />
          ) : null}
          {outOfStock ? "Out of stock" : addLabel}
        </Button>
      </div>

      <div role="status" className="mt-2 min-h-6">
        {state === "added" && (
          <p className="flex flex-wrap items-center gap-x-2 text-success">
            <CircleCheck aria-hidden className="size-5" />
            <span>
              Added {qty > 1 ? `${qty} × ` : ""}
              {product.title} to your basket.
            </span>
            <Link href="/cart" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              View basket
            </Link>
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-destructive">
          <CircleAlert aria-hidden className="size-5 shrink-0" />
          {error}
        </p>
      )}
      {addOnNote && (
        <p className="mt-2 text-muted-foreground">
          £1 items can&apos;t be delivered on their own. Add them to a bigger order, or collect
          free from the shop.
        </p>
      )}

      {/* Sticky mobile add bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-3 shadow-lg transition-transform duration-200 ease-out lg:hidden",
          showBar ? "translate-y-0" : "pointer-events-none translate-y-full"
        )}
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        aria-hidden={!showBar}
        inert={!showBar}
        data-testid="sticky-add-bar"
      >
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1">
            <span className="block truncate text-sm text-muted-foreground">{product.title}</span>
            {priceText && <span className="text-lg font-bold tabular-nums">{priceText}</span>}
          </p>
          <Button type="button" onClick={onAdd} disabled={pending || outOfStock} className="shrink-0">
            {outOfStock ? "Out of stock" : variant ? addLabel : "Choose options"}
          </Button>
        </div>
      </div>
    </div>
  )
}
