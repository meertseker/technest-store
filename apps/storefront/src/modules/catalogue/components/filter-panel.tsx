"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import type { Facet } from "@/lib/catalogue/facets"
import {
  activeFilterCount,
  clearFilters,
  listingHref,
  toggleValue,
  withShowAll,
  type FacetKey,
  type ListingSort,
  type ListingState,
} from "@/lib/catalogue/listing-params"
import { cn } from "@/lib/utils"

export type FitToggle = { device: string } | null

type Props = {
  facets: Facet[]
  state: ListingState
  pathname: string
  defaultSort: ListingSort
  fit: FitToggle
  /** sheet mode: the parent owns a draft state and applies it on "Show results" */
  onChange?: (next: ListingState) => void
  idPrefix: string
}

/**
 * The filter groups. On the desktop rail every tick applies at once (URL
 * change, server render); in the mobile sheet ticks change a draft that the
 * sheet applies on "Show N results". Also a plain GET form, so the rail
 * works without JavaScript (the Apply button then shows).
 */
export default function FilterPanel({
  facets,
  state: stateProp,
  pathname,
  defaultSort,
  fit,
  onChange,
  idPrefix,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The rail shows a tick at once, before the server sends the new listing
  const [shown, setShown] = useState(stateProp)
  useEffect(() => setShown(stateProp), [stateProp])
  const state = onChange ? stateProp : shown

  const apply = (next: ListingState) => {
    if (onChange) return onChange(next)
    setShown(next)
    startTransition(() => {
      router.push(listingHref(pathname, next, { defaultSort }), { scroll: false })
    })
  }

  const count = activeFilterCount(state.filters)

  return (
    <form
      method="get"
      action={pathname}
      aria-busy={pending || undefined}
      onSubmit={(e) => e.preventDefault()}
      className={cn(pending && "opacity-70 transition-opacity")}
    >
      {state.q && <input type="hidden" name="q" value={state.q} />}
      {state.sort !== defaultSort && <input type="hidden" name="sort" value={state.sort} />}
      {state.showAll && <input type="hidden" name="fit" value="all" />}

      {fit && (
        <fieldset className="border-b border-border pb-4">
          <legend className="text-lg font-semibold">Fits your device</legend>
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              // ticked = only items that fit; the URL stores the opposite ("fit=all").
              // No name: without JavaScript the banner's "Show all" link does this.
              checked={!state.showAll}
              onChange={() => apply(withShowAll(state, !state.showAll))}
              className="size-5 shrink-0 accent-foreground"
            />
            <span>Only show items that fit my {fit.device}</span>
          </label>
        </fieldset>
      )}

      {facets.map((facet) => (
        <fieldset key={facet.key} className="border-b border-border py-4">
          <legend className="float-left w-full text-lg font-semibold">{facet.label}</legend>
          <ul className="clear-left pt-2">
            {facet.options.map((o) => {
              const id = `${idPrefix}-${facet.key}-${o.value}`
              const selected = state.filters[facet.key]?.includes(o.value) ?? false
              const disabled = o.count === 0 && !selected
              return (
                <li key={o.value}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3",
                      disabled && "cursor-not-allowed text-muted-foreground"
                    )}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      name={facet.key}
                      value={o.value}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => apply(toggleValue(state, facet.key as FacetKey, o.value))}
                      className="size-5 shrink-0 accent-foreground"
                    />
                    <span className="flex-1">{o.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {o.count}
                      <span className="sr-only"> results</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      {!onChange && count > 0 && (
        <button
          type="button"
          onClick={() => apply(clearFilters(state))}
          className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Clear all filters
        </button>
      )}
      <noscript>
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 items-center rounded border border-border-strong px-4 font-semibold"
        >
          Apply filters
        </button>
      </noscript>
    </form>
  )
}
