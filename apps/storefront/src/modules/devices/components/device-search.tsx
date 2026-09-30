"use client"

import { Search } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { searchDevices } from "@/lib/devices/tree"
import type { DeviceTree } from "@/lib/devices/types"
import DeviceOptions from "./device-options"

type Props = {
  tree: DeviceTree
  returnTo?: string | null
  currentSlug?: string | null
  defaultQuery?: string
  /** Visible label; the hero uses a shorter one */
  label?: string
}

/**
 * Search by model, alias or model number. Without JavaScript the form submits
 * to /devices?q=..., which renders the same results on the server. With
 * JavaScript, results appear as you type.
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
  const results = useMemo(() => searchDevices(tree, q), [tree, q])
  const showLive = typed && q.trim().length > 0

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
      <p role="status" className="sr-only">
        {showLive ? `${results.length} ${results.length === 1 ? "device" : "devices"} found` : ""}
      </p>
      {showLive && (
        <div className="mt-3">
          {results.length ? (
            <DeviceOptions devices={results} returnTo={returnTo} currentSlug={currentSlug} showBrand />
          ) : (
            <p className="rounded bg-surface p-4">
              No device matches &ldquo;{q.trim()}&rdquo;. Try fewer words, or browse by brand below.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
