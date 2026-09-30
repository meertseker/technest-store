import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { blockLinkClass, h1Class } from "@/lib/typography"
import { requireCustomer } from "@lib/data/account"
import AddressForm from "@modules/account/components/address-form"

export const metadata: Metadata = {
  title: "Edit address",
  robots: { index: false },
}

type Props = { params: Promise<{ id: string }> }

export default async function EditAddressPage({ params }: Props) {
  const { id } = await params
  const customer = await requireCustomer(`/account/addresses/${encodeURIComponent(id)}`)
  const a = customer.addresses?.find((x) => x.id === id)
  if (!a) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Link href="/account/addresses" className={`${blockLinkClass} gap-1 self-start`}>
        <ChevronLeft aria-hidden className="size-5" />
        Your addresses
      </Link>
      <h1 className={h1Class}>Edit address</h1>
      <AddressForm
        addressId={a.id}
        initial={{
          first_name: a.first_name ?? "",
          last_name: a.last_name ?? "",
          company: a.company ?? "",
          address_1: a.address_1 ?? "",
          address_2: a.address_2 ?? "",
          city: a.city ?? "",
          postal_code: a.postal_code ?? "",
          phone: a.phone ?? "",
          is_default_shipping: a.is_default_shipping ? "yes" : "",
        }}
      />
    </div>
  )
}
