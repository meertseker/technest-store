"use client"

import { ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  FACET_KEYS,
  listingHref,
  SORT_LABELS,
  withSort,
  type ListingSort,
  type ListingState,
} from "@/lib/catalogue/listing-params"

type Props = {
  state: ListingState
  pathname: string
  options: ListingSort[]
  defaultSort: ListingSort
}

/**
 * Native select (best on phones, fully accessible). Changing it updates the
 * URL; without JavaScript the form's Sort button submits the same GET.
 */
export default function SortSelect({ state, pathname, options, defaultSort }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <form method="get" action={pathname} className="flex items-center gap-2">
      {state.q && <input type="hidden" name="q" value={state.q} />}
      {FACET_KEYS.flatMap((k) =>
        (state.filters[k] ?? []).map((v) => <input key={`${k}-${v}`} type="hidden" name={k} value={v} />)
      )}
      {state.showAll && <input type="hidden" name="fit" value="all" />}
      <label htmlFor="listing-sort" className="whitespace-nowrap">
        Sort<span className="sr-only"> by</span>
      </label>
      <div className="relative">
        <select
          id="listing-sort"
          name="sort"
          value={state.sort}
          aria-busy={pending || undefined}
          onChange={(e) =>
            startTransition(() =>
              router.push(
                listingHref(pathname, withSort(state, e.target.value as ListingSort), {
                  defaultSort,
                }),
                { scroll: false }
              )
            )
          }
          className="min-h-11 cursor-pointer appearance-none rounded border border-border-strong bg-background py-2 pl-3 pr-10 text-base"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {SORT_LABELS[o]}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2"
        />
      </div>
      <noscript>
        <button type="submit" className="min-h-11 rounded border border-border-strong px-3 font-semibold">
          Sort
        </button>
      </noscript>
    </form>
  )
}
