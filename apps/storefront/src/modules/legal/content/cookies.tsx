import { ShopEmail, ShopPhone, TextLink } from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"
import type { ReactNode } from "react"

type CookieRow = { name: string; by: string; purpose: string; lasts: string }

/** Every cookie the site can set. Keep in step with the code (see src/lib/data/cookies.ts). */
export const ESSENTIAL_COOKIES: CookieRow[] = [
  { name: "_medusa_cart_id", by: "Tech Nest", purpose: "Remembers your basket.", lasts: "7 days" },
  { name: "_medusa_jwt", by: "Tech Nest", purpose: "Keeps you signed in to your account.", lasts: "7 days" },
  {
    name: "_medusa_cache_id",
    by: "Tech Nest",
    purpose: "Makes sure you see your own basket and prices, not someone else's cached page.",
    lasts: "24 hours",
  },
  {
    name: "_medusa_pending_customer",
    by: "Tech Nest",
    purpose: "Holds your details while you confirm a new account.",
    lasts: "24 hours",
  },
  {
    name: "tn_device",
    by: "Tech Nest",
    purpose: "Remembers the phone or console you chose, so we only show accessories that fit it. Set only when you choose a device.",
    lasts: "1 year",
  },
  { name: "tn_consent", by: "Tech Nest", purpose: "Remembers your cookie choice.", lasts: "6 months" },
  {
    name: "_medusa_locale",
    by: "Tech Nest",
    purpose: "Remembers your language, only if you change it.",
    lasts: "1 year",
  },
  {
    name: "__stripe_mid, __stripe_sid",
    by: "Stripe",
    purpose: "Fraud prevention when you pay. Set on the checkout page only.",
    lasts: "1 year and 30 minutes",
  },
  {
    name: "__cf_bm, cf_clearance",
    by: "Cloudflare",
    purpose: "Protects the site from bots and attacks, and remembers you passed a security check.",
    lasts: "30 minutes to 1 year",
  },
]

function CookieTable({ caption, rows }: { caption: ReactNode; rows: CookieRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto" role="region" aria-label="Cookies we use" tabIndex={0}>
      <table className="w-full min-w-[560px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="py-2 pr-4 font-semibold">Name</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Set by</th>
            <th scope="col" className="py-2 pr-4 font-semibold">What it does</th>
            <th scope="col" className="py-2 font-semibold">How long</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border align-top">
              <th scope="row" className="py-2 pr-4 font-mono text-base font-normal [overflow-wrap:anywhere]">
                {r.name}
              </th>
              <td className="py-2 pr-4">{r.by}</td>
              <td className="py-2 pr-4">{r.purpose}</td>
              <td className="py-2">{r.lasts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const cookies: LegalContentFn = ({ cookieSettings }) => ({
  summary: (
    <p>
      We use only the cookies the shop needs to work. We do not use advertising cookies, and
      we will not use analytics cookies unless you say yes.
    </p>
  ),
  sections: [
    {
      id: "what-are-cookies",
      heading: "What cookies are",
      body: (
        <p>
          Cookies are small files a website saves in your browser. The law (the Privacy and
          Electronic Communications Regulations) lets us use cookies that are strictly
          necessary for a service you asked for without your consent. For any other cookie we
          must ask you first.
        </p>
      ),
    },
    {
      id: "essential",
      heading: "Cookies we always use",
      body: (
        <>
          <p>
            These are needed for your basket, checkout, account and security. You can block
            them in your browser, but the shop will not work properly.
          </p>
          <CookieTable caption="Essential cookies" rows={ESSENTIAL_COOKIES} />
        </>
      ),
    },
    {
      id: "optional",
      heading: "Optional cookies",
      body: (
        <p>
          We do not use any optional cookies at the moment. If we add analytics to learn how
          the site is used, it will only run after you choose &ldquo;Accept&rdquo;, and we will
          list the cookies here first. &ldquo;Reject&rdquo; is always as easy as
          &ldquo;Accept&rdquo;.
        </p>
      ),
    },
    {
      id: "your-choice",
      heading: "Changing your choice",
      body: (
        <>
          {cookieSettings}
          <p>
          You can also delete cookies at any time in your browser settings. Questions? Call{" "}
          <ShopPhone /> or email <ShopEmail />. See our{" "}
          <TextLink href="/legal/privacy">privacy notice</TextLink> for how we use personal
          data.
          </p>
        </>
      ),
    },
  ],
})

export default cookies
