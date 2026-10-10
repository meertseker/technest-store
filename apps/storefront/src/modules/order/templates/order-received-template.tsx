import Link from "next/link"
import { MailCheck } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { siteConfig } from "@lib/site-config"

/**
 * The confirmation page for a visitor we cannot tie to the order (a link opened
 * later or on another device): the order number and where the details are, no
 * personal data. The confirmation email links here, so it has to make sense on
 * its own.
 */
export default function OrderReceivedTemplate({ displayId }: { displayId: number | string | undefined }) {
  return (
    <div className="content-container py-8 lg:py-12" data-testid="order-received-container">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
            Thanks, your order is placed
          </h1>
          <p className="text-lg">
            Order number{" "}
            <strong className="font-semibold tabular-nums" data-testid="order-number">
              #{displayId}
            </strong>
          </p>
        </header>

        <section
          aria-labelledby="details-title"
          className="flex flex-col gap-3 rounded border border-border p-4 md:p-6"
          data-testid="order-details-emailed"
        >
          <h2 id="details-title" className="flex items-center gap-2 text-[22px] font-semibold leading-tight">
            <MailCheck aria-hidden className="size-6" />
            Your order details are in your email
          </h2>
          <p className="max-w-[68ch]">
            We emailed the full confirmation, with the items, the delivery or collection details and the
            total, to the address on the order. To protect your details, this page does not show them.
          </p>
          <p className="max-w-[68ch] text-muted-foreground">
            Ordered with a Tech Nest account? Sign in to see this order and its progress.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/account/login?next=%2Faccount%2Forders"
              className={buttonVariants({ size: "md", className: "w-full sm:w-auto" })}
            >
              Sign in to see your orders
            </Link>
            <Link
              href="/"
              className={buttonVariants({ variant: "secondary", size: "md", className: "w-full sm:w-auto" })}
            >
              Continue shopping
            </Link>
          </div>
        </section>

        <p className="text-muted-foreground">
          Need help with this order? Call the shop on{" "}
          <a href={`tel:${siteConfig.phone.e164}`} className="text-foreground underline underline-offset-4">
            {siteConfig.phone.display}
          </a>{" "}
          and tell us order number #{displayId}.
        </p>
      </div>
    </div>
  )
}
