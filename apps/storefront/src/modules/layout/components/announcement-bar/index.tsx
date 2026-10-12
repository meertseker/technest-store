import Link from "next/link"
import { Clock, Star, Store } from "lucide-react"
import { getOpenStatus, siteConfig } from "@/lib/site-config"

/**
 * Announcement bar above the header, in the sign's red: three real facts
 * from site-config (Click & Collect, today's live opening status, the Google
 * rating). In flow, not sticky, so it never covers anything. The Google
 * line hides on narrow phones so the bar stays one row.
 */
export default function AnnouncementBar({ now }: { now: Date }) {
  const status = getOpenStatus(now)
  const { value, count } = siteConfig.rating
  const item = "inline-flex min-h-11 items-center gap-2 px-2 text-brand-foreground hover:underline"

  return (
    <div className="bg-brand text-brand-foreground" data-testid="announcement-bar">
      <ul className="content-container flex flex-wrap items-center justify-center gap-x-4 font-medium">
        <li>
          <Link href="/click-and-collect" className={item}>
            <Store aria-hidden className="size-5 shrink-0" />
            Free Click &amp; Collect
          </Link>
        </li>
        <li>
          <Link href="/contact" className={item}>
            <Clock aria-hidden className="size-5 shrink-0" />
            {status.label}
          </Link>
        </li>
        <li className="hidden sm:block">
          <a href={siteConfig.mapsUrl} target="_blank" rel="noopener noreferrer" className={item}>
            <Star aria-hidden className="size-5 shrink-0 fill-current" />
            {value.toFixed(1)} on Google from {count} reviews
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      </ul>
    </div>
  )
}
