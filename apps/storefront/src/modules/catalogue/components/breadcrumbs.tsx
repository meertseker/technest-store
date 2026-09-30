import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Crumb } from "@/lib/catalogue/json-ld"

/**
 * Breadcrumbs (docs/specs/design.md 7.2/7.3). Below 768px only the parent is
 * shown ("‹ Cases"), which is the one step a shopper usually wants; from
 * 768px the full trail. The last crumb is the current page (not a link).
 */
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length < 2) return null
  const parent = crumbs[crumbs.length - 2]
  const current = crumbs[crumbs.length - 1]
  return (
    <nav aria-label="Breadcrumb" className="pt-2">
      <Link
        href={parent.path}
        className="inline-flex min-h-11 items-center gap-1 text-muted-foreground hover:text-foreground hover:underline md:hidden"
      >
        <ChevronLeft aria-hidden className="size-5" />
        <span>
          <span className="sr-only">Back to </span>
          {parent.name}
        </span>
      </Link>
      <ol className="hidden flex-wrap items-center text-muted-foreground md:flex">
        {crumbs.slice(0, -1).map((c) => (
          <li key={c.path} className="flex items-center">
            <Link
              href={c.path}
              className="inline-flex min-h-11 items-center hover:text-foreground hover:underline"
            >
              {c.name}
            </Link>
            <ChevronRight aria-hidden className="mx-1 size-4" />
          </li>
        ))}
        <li>
          <span aria-current="page" className="font-medium text-foreground">
            {current.name}
          </span>
        </li>
      </ol>
    </nav>
  )
}
