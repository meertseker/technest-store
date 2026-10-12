import { ExternalLink, Star } from "lucide-react"
import data from "@/content/google-reviews.json"
import {
  approxReviewMonth,
  displayAuthor,
  pickFeaturedReviews,
  type GoogleReview,
} from "@/lib/reviews/reviews"
import { siteConfig } from "@/lib/site-config"
import { blockLinkClass, h2Class } from "@/lib/typography"

const REVIEWS: GoogleReview[] = data.reviews

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="sr-only">Rated {value} out of 5</span>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={i < value ? "size-4 fill-current text-foreground" : "size-4 text-border-strong"}
        />
      ))}
    </span>
  )
}

/**
 * Home page shop reviews (docs/specs/design.md 7.1): the newest Google reviews
 * with at least 60 characters, text exactly as written, always attributed to
 * Google with a link to the Maps profile. Not product ratings: no JSON-LD.
 */
export default function GoogleReviews({ count = 3 }: { count?: number }) {
  const reviews = pickFeaturedReviews(REVIEWS, count)
  if (!reviews.length) return null
  const { value, count: total } = siteConfig.rating

  return (
    <section aria-labelledby="reviews-heading" className="content-container section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-heading" className={h2Class}>
            {value.toFixed(1)} on Google from {total} reviews
          </h2>
          <p className="mt-1 text-muted-foreground">Reviews from Google, as customers wrote them</p>
        </div>
        <a
          href={siteConfig.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${blockLinkClass} gap-2`}
        >
          Read all reviews on Google
          <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(opens Google Maps in a new tab)</span>
        </a>
      </div>
      <ul className="mt-6 grid gap-4 lg:grid-cols-3">
        {reviews.map((r) => {
          const month = approxReviewMonth(r.relative_date, data.collected_at)
          return (
            <li key={r.id}>
              <figure className="flex h-full flex-col gap-3 rounded-lg border border-border bg-background p-5">
                <Stars value={r.stars} />
                <blockquote className="max-w-[68ch] whitespace-pre-line break-words">
                  {r.text}
                </blockquote>
                <figcaption className="mt-auto text-sm text-muted-foreground" data-small-text>
                  <span className="font-semibold text-foreground">{displayAuthor(r.author)}</span>
                  {" on Google"}
                  {month && `, ${month}`}
                </figcaption>
              </figure>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
