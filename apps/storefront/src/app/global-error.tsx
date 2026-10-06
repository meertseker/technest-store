"use client"

import "../styles/globals.css"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { reportClientError } from "@lib/monitoring/report-client"
import { siteConfig } from "@lib/site-config"

/**
 * Last resort: replaces the whole document when the root layout or a route
 * group's layout fails, where no other error boundary can catch it. It brings
 * its own <html> and <body> and depends on nothing that could have failed
 * (no data, no header, no footer).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  // a boundary swallows the error, so report it here or nobody hears of it
  // (never from /checkout: see lib/monitoring/report-client.ts)
  useEffect(() => reportClientError(error), [error])

  return (
    <html lang="en-GB" data-mode="light">
      <head>
        <title>Something went wrong | Tech Nest</title>
        <meta name="robots" content="noindex" />
      </head>
      <body>
        <header className="border-b border-border">
          <div className="content-container flex h-[var(--header-h)] items-center">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" aria-label="Tech Nest home" className="inline-flex min-h-11 items-center">
              <span className="whitespace-nowrap text-lg font-extrabold uppercase tracking-tight text-brand lg:text-2xl">
                Tech Nest
              </span>
            </a>
          </div>
        </header>
        <main id="main" className="content-container flex flex-col items-start gap-4 py-12 lg:py-20">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
            Something went wrong
          </h1>
          <p role="alert" className="max-w-[68ch] text-muted-foreground">
            We couldn&apos;t load this page. Please try again in a moment.
          </p>
          {/* a full reload: the layout that failed has to be fetched again from scratch */}
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <p className="max-w-[68ch] text-muted-foreground">
            If it keeps happening, call the shop on{" "}
            <a
              href={`tel:${siteConfig.phone.e164}`}
              className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
            >
              {siteConfig.phone.display}
            </a>
            .
          </p>
        </main>
      </body>
    </html>
  )
}
