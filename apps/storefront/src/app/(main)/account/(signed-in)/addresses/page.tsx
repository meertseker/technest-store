import { Metadata } from "next"
import Link from "next/link"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import Notice from "@/components/ui/notice"
import { h1Class } from "@/lib/typography"
import { requireCustomer } from "@lib/data/account"
import { deleteAddressAction } from "@lib/data/account-actions"

export const metadata: Metadata = {
  title: "Your addresses",
  robots: { index: false },
}

const SAVED: Record<string, { tone: "success" | "info"; text: string }> = {
  added: { tone: "success", text: "Address saved." },
  updated: { tone: "success", text: "Address updated." },
  removed: { tone: "success", text: "Address removed." },
  "remove-failed": { tone: "info", text: "We could not remove that address. Please try again." },
}

type Props = { searchParams: Promise<{ saved?: string }> }

export default async function AddressesPage({ searchParams }: Props) {
  const customer = await requireCustomer("/account/addresses")
  const saved = SAVED[(await searchParams).saved ?? ""]
  const addresses = [...(customer.addresses ?? [])].sort(
    (a, b) => Number(b.is_default_shipping) - Number(a.is_default_shipping)
  )

  return (
    <div>
      <h1 className={h1Class}>Your addresses</h1>
      <p className="mt-2 max-w-[68ch] text-muted-foreground">
        Saved addresses fill in automatically at checkout. We deliver to UK addresses only.
      </p>
      {saved && (
        <Notice tone={saved.tone} className="mt-6">
          {saved.text}
        </Notice>
      )}

      <Link href="/account/addresses/new" className={buttonVariants({ variant: "secondary", className: "mt-6 w-full sm:w-auto" })}>
        <Plus aria-hidden />
        Add an address
      </Link>

      {addresses.length === 0 ? (
        <p className="mt-6 rounded bg-surface p-4">You have no saved addresses yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {addresses.map((a) => {
            const name = [a.first_name, a.last_name].filter(Boolean).join(" ")
            const summary = `${name ? `${name}, ` : ""}${a.address_1}, ${a.postal_code}`
            return (
              <li key={a.id} className="flex flex-col rounded border border-border p-4" data-testid="address-card">
                {a.is_default_shipping && (
                  <p className="mb-2 self-start rounded-full bg-surface-2 px-3 py-0.5 text-sm font-semibold">Main delivery address</p>
                )}
                <address className="not-italic">
                  {name && (
                    <>
                      <span className="font-semibold">{name}</span>
                      <br />
                    </>
                  )}
                  {a.company && (
                    <>
                      {a.company}
                      <br />
                    </>
                  )}
                  {a.address_1}
                  <br />
                  {a.address_2 && (
                    <>
                      {a.address_2}
                      <br />
                    </>
                  )}
                  {a.city}
                  <br />
                  {a.postal_code}
                  {a.phone && (
                    <>
                      <br />
                      <span className="text-muted-foreground">{a.phone}</span>
                    </>
                  )}
                </address>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/account/addresses/${a.id}`} className={buttonVariants({ variant: "secondary", size: "md" })}>
                    <Pencil aria-hidden />
                    Edit<span className="sr-only"> {summary}</span>
                  </Link>
                  {/* Two steps so an address is never removed by one slip (ux: confirm destructive actions) */}
                  <details className="group">
                    <summary className={buttonVariants({ variant: "ghost", size: "md", className: "list-none [&::-webkit-details-marker]:hidden" })}>
                      <Trash2 aria-hidden />
                      Remove<span className="sr-only"> {summary}</span>
                    </summary>
                    <form action={deleteAddressAction} className="mt-2 flex flex-col gap-2 rounded bg-surface p-3">
                      <p>Remove this address?</p>
                      <input type="hidden" name="address_id" value={a.id} />
                      <button type="submit" className={buttonVariants({ variant: "secondary", size: "md" })}>
                        Yes, remove it
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
