import { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { blockLinkClass, h1Class } from "@/lib/typography"
import { requireCustomer } from "@lib/data/account"
import AddressForm from "@modules/account/components/address-form"

export const metadata: Metadata = {
  title: "Add an address",
  robots: { index: false },
}

export default async function NewAddressPage() {
  const customer = await requireCustomer("/account/addresses/new")
  const first = !customer.addresses?.length
  return (
    <div className="flex flex-col gap-6">
      <Link href="/account/addresses" className={`${blockLinkClass} gap-1 self-start`}>
        <ChevronLeft aria-hidden className="size-5" />
        Your addresses
      </Link>
      <h1 className={h1Class}>Add an address</h1>
      <AddressForm
        initial={{
          first_name: customer.first_name ?? "",
          last_name: customer.last_name ?? "",
          phone: customer.phone ?? "",
          is_default_shipping: first ? "yes" : "",
        }}
      />
    </div>
  )
}
