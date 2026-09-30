import Link from "next/link"
import { getConsent } from "@/lib/consent/server"
import CookieChoiceButtons from "./cookie-choice-buttons"

/**
 * Server-rendered, in-flow bar above the header. It is in the first HTML, so
 * there is no layout shift, and it is not fixed, so it never hides focused
 * content (WCAG 2.4.11). No client JavaScript. Renders nothing once a choice
 * is stored.
 */
export default async function CookieBanner() {
  if (await getConsent()) return null

  return (
    <section aria-labelledby="cookie-banner-title" className="border-b border-border bg-surface">
      <div className="content-container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div>
          <h2 id="cookie-banner-title" className="font-semibold">
            Cookies on Tech Nest
          </h2>
          <p className="mt-1">
            We use essential cookies to make the shop work. Analytics cookies, which help us
            see how the site is used, stay off unless you accept.{" "}
            <Link href="/legal/cookies" className="font-semibold underline underline-offset-4">
              Cookie policy
            </Link>
          </p>
        </div>
        <CookieChoiceButtons className="shrink-0" />
      </div>
    </section>
  )
}
