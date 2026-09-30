import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ShoppingBag, UserPlus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import Notice from "@/components/ui/notice"
import { safeReturnTo } from "@/lib/forms/state"
import { h1Class, h2Class } from "@/lib/typography"
import { retrieveCustomer } from "@lib/data/customer"
import LoginForm from "@modules/account/components/login-form"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Tech Nest account to see your orders, addresses and trade account.",
  robots: { index: false },
}

type Props = { searchParams: Promise<{ next?: string; reset?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { next: rawNext, reset } = await searchParams
  const next = safeReturnTo(rawNext)
  if (await retrieveCustomer().catch(() => null)) redirect(next)
  const registerHref = next === "/account" ? "/account/register" : `/account/register?next=${encodeURIComponent(next)}`

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-6 xl:col-span-5">
        <h1 className={h1Class}>Sign in</h1>
        {reset === "1" && (
          <Notice tone="success" title="Your password has been changed" className="mt-6">
            Sign in with your new password.
          </Notice>
        )}
        <div className="mt-6">
          <LoginForm next={next} />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-6 xl:col-span-5 xl:col-start-8">
        <section aria-labelledby="new-here" className="rounded border border-border bg-surface p-6">
          <h2 id="new-here" className={h2Class}>
            New to Tech Nest?
          </h2>
          <p className="mt-2">
            An account keeps your orders and addresses in one place, and you need one to apply for trade prices.
          </p>
          <Link href={registerHref} className={buttonVariants({ variant: "secondary", className: "mt-4 w-full sm:w-auto" })}>
            <UserPlus aria-hidden />
            Create an account
          </Link>
        </section>
        <section aria-labelledby="no-account" className="rounded border border-border p-6">
          <h2 id="no-account" className="text-lg font-semibold">
            You do not need an account to shop
          </h2>
          <p className="mt-2">Check out as a guest. We email your receipt and order updates either way.</p>
          <Link href="/" className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4">
            <ShoppingBag aria-hidden className="size-5" />
            Continue shopping
          </Link>
        </section>
      </div>
    </div>
  )
}
