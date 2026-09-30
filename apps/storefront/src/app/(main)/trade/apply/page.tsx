import { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { siteConfig } from "@/lib/site-config"
import { blockLinkClass, h1Class, h2Class, leadClass } from "@/lib/typography"
import { retrieveCustomer } from "@lib/data/customer"
import { getMyTradeApplication } from "@lib/data/trade"
import TradeApplicationForm from "@modules/trade/components/trade-application-form"
import TradeStatus from "@modules/trade/components/trade-status"

export const metadata: Metadata = {
  title: "Apply for a trade account",
  description: "Apply for a Tech Nest trade account. It takes about two minutes.",
  alternates: { canonical: "/trade/apply" },
}

/** E2's emails link here (docs/contracts/emails.md: /trade/apply) */
export default async function TradeApplyPage() {
  const customer = await retrieveCustomer().catch(() => null)
  const application = customer ? await getMyTradeApplication() : undefined

  return (
    <div className="content-container flex flex-col gap-6 py-10 lg:py-14">
      <Link href="/trade" className={`${blockLinkClass} gap-1 self-start`}>
        <ChevronLeft aria-hidden className="size-5" />
        Trade accounts
      </Link>
      <h1 className={h1Class}>Apply for a trade account</h1>

      {!customer ? (
        <div className="flex max-w-[560px] flex-col gap-4">
          <p className={leadClass}>
            Trade accounts belong to a customer account, so your trade prices appear when you sign in. Sign in or create an
            account first, then you come straight back here.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/account/login?next=/trade/apply" className={buttonVariants({ className: "w-full sm:w-auto" })}>
              Sign in to apply
            </Link>
            <Link
              href="/account/register?next=/trade/apply"
              className={buttonVariants({ variant: "secondary", className: "w-full sm:w-auto" })}
            >
              Create an account
            </Link>
          </div>
        </div>
      ) : application === undefined ? (
        <p className="max-w-[560px] rounded bg-surface p-4">
          We could not check your trade account just now. Please try again soon, or call {siteConfig.phone.display}.
        </p>
      ) : application && application.status !== "rejected" ? (
        <div className="max-w-[720px]">
          <TradeStatus application={application} />
        </div>
      ) : (
        <>
          {application?.status === "rejected" && (
            <div className="max-w-[720px]">
              <h2 className={`${h2Class} sr-only`}>Your last application</h2>
              <TradeStatus application={application} headingLevel={3} showActions={false} />
            </div>
          )}
          <p className={leadClass}>It takes about two minutes. All fields are needed unless they say optional.</p>
          <TradeApplicationForm
            initial={{
              company_name: application?.company_name ?? customer.company_name ?? "",
              business_type: application?.business_type ?? "",
              vat_number: application?.vat_number ?? "",
              companies_house_number: application?.companies_house_number ?? "",
              contact_name:
                application?.contact.name ?? [customer.first_name, customer.last_name].filter(Boolean).join(" "),
              contact_phone: application?.contact.phone ?? customer.phone ?? "",
              contact_email: application?.contact.email ?? customer.email,
            }}
          />
        </>
      )}
    </div>
  )
}
