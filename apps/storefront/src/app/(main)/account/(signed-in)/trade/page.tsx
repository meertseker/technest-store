import { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import Notice from "@/components/ui/notice"
import { siteConfig } from "@/lib/site-config"
import { blockLinkClass, h1Class } from "@/lib/typography"
import { requireCustomer } from "@lib/data/account"
import { getMyTradeApplication } from "@lib/data/trade"
import TradeStatus from "@modules/trade/components/trade-status"

export const metadata: Metadata = {
  title: "Trade account",
  robots: { index: false },
}

type Props = { searchParams: Promise<{ submitted?: string }> }

/** E2's trade emails link here (docs/contracts/emails.md: /account/trade) */
export default async function AccountTradePage({ searchParams }: Props) {
  await requireCustomer("/account/trade")
  const submitted = (await searchParams).submitted === "1"
  const application = await getMyTradeApplication()

  return (
    <div className="flex flex-col gap-6">
      <h1 className={h1Class}>Trade account</h1>
      {submitted && application?.status === "pending" && (
        <Notice tone="success" title="Application sent">
          Thank you. We have emailed you a copy.
        </Notice>
      )}
      {application === undefined ? (
        <p className="rounded bg-surface p-4">
          We could not load your trade account just now. Please try again soon, or call {siteConfig.phone.display}.
        </p>
      ) : application === null ? (
        <div className="rounded border border-border p-4 lg:p-6">
          <p className="text-lg font-semibold">You have not applied for a trade account.</p>
          <p className="mt-2 max-w-[68ch]">
            Trade accounts get lower prices, shown without VAT, on many accessories when you buy in quantity.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/trade/apply" className={buttonVariants({ className: "w-full sm:w-auto" })}>
              Apply for a trade account
            </Link>
            <Link href="/trade" className={blockLinkClass}>
              How trade accounts work
            </Link>
          </div>
        </div>
      ) : (
        <TradeStatus application={application} />
      )}
    </div>
  )
}
