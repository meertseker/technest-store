"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { SlidersHorizontal, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  buildFacets,
  countMatches,
  type Facet,
  type FacetIndexItem,
  type Labels,
} from "@/lib/catalogue/facets"
import {
  activeFilterCount,
  clearFilters,
  listingHref,
  type ListingSort,
  type ListingState,
} from "@/lib/catalogue/listing-params"
import FilterPanel, { type FitToggle } from "./filter-panel"

type Props = {
  facets: Facet[]
  index: FacetIndexItem[]
  state: ListingState
  pathname: string
  defaultSort: ListingSort
  fit: FitToggle
}

/**
 * Mobile filters (docs/specs/design.md 7.2): a bottom sheet (90vh) with
 * "Fits your device" first, the facets with live counts, and a sticky footer
 * [Clear all] [Show 42 results]. Nothing changes until "Show results".
 */
export default function FilterSheet({ facets, index, state, pathname, defaultSort, fit }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ListingState>(state)
  const [, startTransition] = useTransition()

  const labels = useMemo(() => {
    const l: Labels = {}
    facets.forEach((f) => f.options.forEach((o) => (l[`${f.key}:${o.value}`] = o.label)))
    return l
  }, [facets])
  const order = useMemo(
    () => ({ category: facets.find((f) => f.key === "category")?.options.map((o) => o.value) }),
    [facets]
  )

  const draftFacets = useMemo(
    () => buildFacets(index, draft.filters, labels, order),
    [index, draft.filters, labels, order]
  )
  // Toggling "fits your device" changes the set itself, so the count is only known after applying
  const draftCount = draft.showAll === state.showAll ? countMatches(index, draft.filters) : null
  const active = activeFilterCount(state.filters) + (fit && state.showAll ? 1 : 0)

  const openSheet = () => {
    setDraft(state)
    setOpen(true)
  }
  const apply = () => {
    setOpen(false)
    startTransition(() => router.push(listingHref(pathname, draft, { defaultSort }), { scroll: false }))
  }

  if (!facets.length && !fit) return null

  return (
    <>
      <Button type="button" variant="secondary" size="md" onClick={openSheet} className="lg:hidden">
        <SlidersHorizontal aria-hidden />
        Filters{active ? ` (${active})` : ""}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-[80] lg:hidden">
        <div className="fixed inset-0 bg-foreground/40" aria-hidden />
        <div className="fixed inset-x-0 bottom-0 flex max-h-[90vh]">
          <DialogPanel className="flex max-h-[90vh] w-full flex-col rounded-t-lg bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <DialogTitle className="text-lg font-semibold">Filters</DialogTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded hover:bg-surface"
              >
                <X aria-hidden className="size-6" />
                <span className="sr-only">Close filters</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <FilterPanel
                facets={draftFacets}
                state={draft}
                pathname={pathname}
                defaultSort={defaultSort}
                fit={fit}
                onChange={setDraft}
                idPrefix="sheet"
              />
            </div>
            <div
              className="flex gap-3 border-t border-border px-4 pt-3"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setDraft({ ...clearFilters(draft), showAll: state.showAll })}
              >
                Clear all
              </Button>
              <Button type="button" className="flex-[2]" onClick={apply}>
                {draftCount === null
                  ? "Show results"
                  : `Show ${draftCount} result${draftCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
