import { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, PhoneCall } from "lucide-react"
import { siteConfig } from "@/lib/site-config"
import { blockLinkClass, h1Class, leadClass } from "@/lib/typography"
import { retrieveCustomer } from "@lib/data/customer"
import { getCurrentDevice, listDevices } from "@lib/data/devices"
import RepairBookingForm from "@modules/repairs/components/repair-booking-form"

export const metadata: Metadata = {
  title: "Book a repair",
  description: "Send Tech Nest a repair request. We call you back with a price and a time. Most repairs same day.",
  alternates: { canonical: "/repairs/book" },
}

export default async function BookRepairPage() {
  const [tree, device, customer] = await Promise.all([
    listDevices(),
    getCurrentDevice().catch(() => null),
    retrieveCustomer().catch(() => null),
  ])
  const { phone } = siteConfig

  return (
    <div className="content-container flex flex-col gap-6 py-10 lg:py-14">
      <Link href="/repairs" className={`${blockLinkClass} gap-1 self-start`}>
        <ChevronLeft aria-hidden className="size-5" />
        Repairs
      </Link>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className={h1Class}>Book a repair</h1>
          <p className={`mt-3 ${leadClass}`}>
            Tell us about your device and we will call you back with a price and a time. Nothing is charged online.
          </p>
          <div className="mt-8">
            <RepairBookingForm
              tree={tree}
              currentDevice={device ? { id: device.id, model: device.model } : null}
              phone={{ display: phone.display, e164: phone.e164 }}
              initial={
                customer
                  ? {
                      name: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
                      phone: customer.phone ?? "",
                      email: customer.email,
                    }
                  : undefined
              }
            />
          </div>
        </div>
        <aside aria-labelledby="rather-call" className="lg:col-span-4">
          <div className="rounded border border-border bg-surface p-4 lg:sticky lg:top-[calc(var(--header-h)+24px)]">
            <h2 id="rather-call" className="flex items-center gap-2 text-lg font-semibold">
              <PhoneCall aria-hidden className="size-5" />
              Rather talk to us?
            </h2>
            <p className="mt-1">Call the shop and we can book you in straight away.</p>
            <a href={`tel:${phone.e164}`} className={blockLinkClass}>
              Call {phone.display}
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
