"use client"

import { Search } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { searchDevices } from "@/lib/devices/tree"
import type { DeviceTree } from "@/lib/devices/types"
import DeviceOptions from "./device-options"

/** Max results shown, server-rendered or live */
export const SEARCH_LIMIT = 24

type Props = {
  tree: DeviceTree
  returnTo?: string | null
  currentSlug?: string | null
  /** The submitted query (?q=), rendered on the server */
  defaultQuery?: string
  /** Visible label; the hero uses a shorter one */
  label?: string
}

const resultsHeading = (count: number, q: string) =>
  count
    ? `${count} ${count === 1 ? "device matches" : "devices match"} “${q}”`
    : `No device matches “${q}”`

/**
 * Search by model, alias or model number. This component owns the one and
 * only results list: without JavaScript the form submits to /devices?q=...
 * and the list is server-rendered from `defaultQuery`; with JavaScript the
 * same list updates as you type (there is never a second, stale list).
 */
export default function DeviceSearch({
  tree,
  returnTo,
  currentSlug,
  defaultQuery = "",
  label = "Search for your phone or console",
}: Props) {
  const id = useId()
  const [q, setQ] = useState(defaultQuery)
  const [typed, setTyped] = useState(false)
  const query = q.trim()
  const results = useMemo(() => searchDevices(tree, query, SEARCH_LIMIT), [tree, query])

  return (
    <div>
      <form action="/devices" method="get" role="search" aria-label="Devices">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <label htmlFor={`${id}-q`} className="block font-semibold">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          For example: iPhone 15 Pro, S24, PS5 or a model number
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id={`${id}-q`}
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={60}
            aria-describedby={`${id}-hint`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setTyped(true)
            }}
            className="min-h-12 w-full min-w-0 flex-1 rounded border border-border-strong bg-background px-4 text-base"
          />
          <button
            type="submit"
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded bg-foreground px-4 font-semibold text-background transition-colors duration-150 hover:bg-muted-foreground"
          >
            <Search aria-hidden className="size-5" />
            <span className="sr-only sm:not-sr-only">Search</span>
          </button>
        </div>
      </form>
      {/* Announces live results only; a submitted search is read via the heading */}
      <p role="status" className="sr-only">
        {typed && query
          ? `${results.length} ${results.length === 1 ? "device" : "devices"} found`
          : ""}
      </p>
      {query && (
        <section aria-labelledby={`${id}-results`} className="mt-4" data-testid="device-results">
          <h2 id={`${id}-results`} className="text-xl font-semibold">
            {resultsHeading(results.length, query)}
          </h2>
          <div className="mt-3">
            {results.length ? (
              <DeviceOptions
                devices={results}
                returnTo={returnTo}
                currentSlug={currentSlug}
                showBrand
              />
            ) : (
              <p className="rounded bg-surface p-4">
                Try fewer words, or choose your brand below.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
