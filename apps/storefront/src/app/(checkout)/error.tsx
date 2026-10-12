"use client"

import { buttonVariants } from "@/components/ui/button"
import { siteConfig } from "@lib/site-config"
import { h1Class } from "@/lib/typography"

/**
 * Shown inside the checkout header when the checkout page fails (for example
 * the backend cannot be reached). The links are plain <a> on purpose: every
 * way out is a full page load, like the rest of checkout, so the retry gets a
 * fresh page and the strict checkout CSP is not carried elsewhere.
 */
export default function CheckoutError(_props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="content-container flex flex-col items-start gap-4 py-12 lg:py-20" data-testid="checkout-error">
      <h1 className={h1Class}>
        We couldn&apos;t load the checkout
      </h1>
      <p role="alert" className="max-w-[68ch] text-muted-foreground">
        Something went wrong on our side. Your basket is saved. Please try again in a moment.
      </p>
      <div className="flex flex-wrap gap-3">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/checkout" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Try again
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/basket" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Back to basket
        </a>
      </div>
      <p className="max-w-[68ch] text-muted-foreground">
        If you had already confirmed a payment, don&apos;t pay again: check your email for the order
        confirmation, or call the shop on{" "}
        <a
          href={`tel:${siteConfig.phone.e164}`}
          className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
        >
          {siteConfig.phone.display}
        </a>
        .
      </p>
    </div>
  )
}
