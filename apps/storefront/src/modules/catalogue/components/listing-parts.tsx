import Link from "next/link"
import { CircleCheck, Phone, Smartphone, X } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import type { Chip } from "@/lib/catalogue/facets"
import type { FitMode } from "@/lib/catalogue/listing"
import {
  clearFilters,
  listingHref,
  toggleValue,
  withPage,
  withShowAll,
  type ListingSort,
  type ListingState,
} from "@/lib/catalogue/listing-params"
import { siteConfig } from "@/lib/site-config"

type Nav = { state: ListingState; pathname: string; defaultSort: ListingSort }

const href = ({ pathname, defaultSort }: Nav, s: ListingState) =>
  listingHref(pathname, s, { defaultSort })

/** "Showing items that fit iPhone 16 · Show all" (spec 7.2), or a way back to the device filter */
export function FitBanner({
  fit,
  pickerHref,
  ...nav
}: Nav & { fit: FitMode; pickerHref: string }) {
  if (fit.kind === "none" || fit.kind === "not-applicable") return null
  const filtered = fit.kind === "filtered"
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-success-subtle px-4 py-2">
      {filtered ? (
        <CircleCheck aria-hidden className="size-5 shrink-0 text-success" />
      ) : (
        <Smartphone aria-hidden className="size-5 shrink-0" />
      )}
      <p className="flex-1">
        {filtered ? (
          <>
            Showing items that fit your <strong className="font-semibold">{fit.device}</strong>
          </>
        ) : (
          <>
            Showing all items. {fit.fitting} fit{fit.fitting === 1 ? "s" : ""} your{" "}
            <strong className="font-semibold">{fit.device}</strong>
          </>
        )}
      </p>
      <span className="flex flex-wrap gap-x-4">
        <Link
          href={href(nav, withShowAll(nav.state, filtered))}
          scroll={false}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {filtered ? "Show all" : `Only ones that fit`}
        </Link>
        <Link
          href={pickerHref}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Change device
        </Link>
      </span>
    </div>
  )
}

/** Removable chips for the active filters + "Clear all"; they wrap, never a clipped row */
export function ActiveChips({ chips, ...nav }: Nav & { chips: Chip[] }) {
  if (!chips.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <h2 className="sr-only">Active filters</h2>
      <ul className="contents">
        {chips.map((c) => (
          <li key={`${c.key}-${c.value}`}>
            <Link
              href={href(nav, toggleValue(nav.state, c.key, c.value))}
              scroll={false}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface px-4 text-base transition-colors duration-150 hover:bg-surface-2"
            >
              {c.label}
              <X aria-hidden className="size-4" />
              <span className="sr-only">(remove)</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={href(nav, clearFilters(nav.state))}
        scroll={false}
        className="inline-flex min-h-11 items-center px-2 font-semibold underline underline-offset-4"
      >
        Clear all
      </Link>
    </div>
  )
}

/**
 * "Load more" + "Showing 24 of 86". Pages are real URLs (?page=2) for search
 * engines and the back button; page N shows the first N x 24 items, and the
 * link lands on the first new one.
 */
export function LoadMore({
  shown,
  total,
  hasMore,
  ...nav
}: Nav & { shown: number; total: number; hasMore: boolean }) {
  if (!total) return null
  const next = withPage(nav.state, nav.state.page + 1)
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-muted-foreground" aria-live="polite">
        Showing {shown} of {total}
      </p>
      {hasMore && (
        <Link
          href={`${href(nav, next)}#item-${shown + 1}`}
          rel="next"
          className={buttonVariants({ variant: "secondary", className: "w-full sm:w-auto sm:min-w-64" })}
        >
          Load more
        </Link>
      )}
    </div>
  )
}

/** Spec 7.2 empty state: say why, then offer the ways out */
export function EmptyState({
  what,
  device,
  hasFilters,
  ...nav
}: Nav & { what: string; device: string | null; hasFilters: boolean }) {
  const title = `No ${what}${device ? ` for ${device}` : ""}${hasFilters ? " with these filters" : ""}`
  return (
    <div className="mt-8 rounded bg-surface p-6">
      <h2 className="text-[22px] font-semibold leading-tight">{title}</h2>
      <p className="mt-2 max-w-prose">
        Try fewer filters or all devices. We stock more in the shop than we list online, so it is
        worth asking.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {hasFilters && (
          <Link href={href(nav, clearFilters(nav.state))} className={buttonVariants({ variant: "secondary" })}>
            Clear filters
          </Link>
        )}
        {device && (
          <Link
            href={href(nav, withShowAll(clearFilters(nav.state), true))}
            className={buttonVariants({ variant: "secondary" })}
          >
            Show all devices
          </Link>
        )}
        <a href={`tel:${siteConfig.phone.e164}`} className={buttonVariants({ variant: "secondary" })}>
          <Phone aria-hidden />
          Ask the shop
        </a>
      </div>
    </div>
  )
}
