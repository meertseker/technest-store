import { permanentRedirect } from "next/navigation"

/** The dtc-starter's old order URL; emails use /account/orders/{id} */
export default async function LegacyOrderDetails({ params }: { params: Promise<{ id: string }> }) {
  permanentRedirect(`/account/orders/${encodeURIComponent((await params).id)}`)
}
