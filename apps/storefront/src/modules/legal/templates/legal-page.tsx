import { AlertTriangle } from "lucide-react"
import { LEGAL_DRAFT, LEGAL_LAST_UPDATED } from "@/lib/legal/business"
import { LEGAL_PAGES } from "@/lib/legal/pages"
import type { LegalContent } from "@modules/legal/types"
import Link from "next/link"

/** Styles for the running text inside each section (kept here, not in globals.css) */
const PROSE =
  "mt-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"

const lastUpdated = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(LEGAL_LAST_UPDATED))

/**
 * Long-form legal page: 68ch reading width, a contents list, numbered H2
 * sections with anchors, and links to the other legal pages at the end.
 */
export default function LegalPage({
  slug,
  title,
  content,
}: {
  slug: string
  title: string
  content: LegalContent
}) {
  return (
    <div className="content-container py-10 lg:py-14">
      <article className="max-w-[68ch]">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">Last updated {lastUpdated}</p>

        {LEGAL_DRAFT && (
          <div
            role="note"
            className="mt-6 flex gap-3 rounded border border-warning bg-warning-subtle p-4 text-foreground"
          >
            <AlertTriangle aria-hidden className="mt-1 size-5 shrink-0 text-warning" />
            <p>
              <strong>Draft for review.</strong> This page has not yet been checked by Tech
              Nest and may change. Highlighted items in brackets are still to be confirmed.
            </p>
          </div>
        )}

        <div className="mt-6 text-lg">{content.summary}</div>

        <nav aria-labelledby="legal-contents" className="mt-8 rounded border border-border bg-surface p-4">
          <h2 id="legal-contents" className="text-lg font-semibold">
            Contents
          </h2>
          <ol className="mt-2 list-decimal pl-6">
            {content.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {content.sections.map((s, i) => (
          <section key={s.id} aria-labelledby={s.id} className="mt-10">
            <h2 id={s.id} className="text-[22px] font-semibold leading-tight lg:text-[28px]">
              {i + 1}. {s.heading}
            </h2>
            <div className={PROSE}>{s.body}</div>
          </section>
        ))}
      </article>

      <nav aria-labelledby="legal-more" className="mt-14 max-w-[68ch] border-t border-border pt-8">
        <h2 id="legal-more" className="text-lg font-semibold">
          Other policies
        </h2>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {LEGAL_PAGES.filter((p) => p.slug !== slug).map((p) => (
            <li key={p.slug}>
              <Link href={`/legal/${p.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
