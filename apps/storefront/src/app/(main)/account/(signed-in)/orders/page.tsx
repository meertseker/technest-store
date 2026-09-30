import { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { h1Class } from "@/lib/typography"
import { ORDERS_PER_PAGE, listOrdersPage, requireCustomer } from "@lib/data/account"
import OrderCard from "@modules/account/components/order-card"

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false },
}

type Props = { searchParams: Promise<{ page?: string }> }

export default async function OrdersPage({ searchParams }: Props) {
  const raw = Number((await searchParams).page ?? 1)
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1
  await requireCustomer(page > 1 ? `/account/orders?page=${page}` : "/account/orders")
  const data = await listOrdersPage(page)
  const pages = data ? Math.max(1, Math.ceil(data.count / ORDERS_PER_PAGE)) : 1

  return (
    <div>
      <h1 className={h1Class}>Your orders</h1>
      <p className="mt-2 max-w-[68ch] text-muted-foreground">
        Orders placed while signed in. Checked out as a guest? Use the link in your order confirmation email.
      </p>

      {data === null ? (
        <p className="mt-6 rounded bg-surface p-4">We could not load your orders just now. Please try again soon.</p>
      ) : data.orders.length === 0 ? (
        <div className="mt-6 rounded bg-surface p-6">
          <p>{page > 1 ? "There are no more orders." : "You have not ordered with this account yet."}</p>
          <Link href={page > 1 ? "/account/orders" : "/"} className={buttonVariants({ variant: "secondary", className: "mt-4 w-full sm:w-auto" })}>
            {page > 1 ? "Back to your latest orders" : "Start shopping"}
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-muted-foreground" aria-live="polite">
            {data.count} {data.count === 1 ? "order" : "orders"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {data.orders.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} />
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Order pages" className="mt-6 flex flex-wrap justify-between gap-2">
              {page > 1 ? (
                <Link href={page === 2 ? "/account/orders" : `/account/orders?page=${page - 1}`} className={buttonVariants({ variant: "secondary", size: "md" })}>
                  <ChevronLeft aria-hidden />
                  Newer orders
                </Link>
              ) : (
                <span />
              )}
              {page < pages && (
                <Link href={`/account/orders?page=${page + 1}`} className={buttonVariants({ variant: "secondary", size: "md" })}>
                  Older orders
                  <ChevronRight aria-hidden />
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  )
}
