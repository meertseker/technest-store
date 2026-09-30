import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { safeReturnTo } from "@/lib/forms/state"
import { h1Class, leadClass, linkClass } from "@/lib/typography"
import { retrieveCustomer } from "@lib/data/customer"
import RegisterForm from "@modules/account/components/register-form"

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Tech Nest account to track orders, save addresses and apply for trade prices.",
  robots: { index: false },
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function RegisterPage({ searchParams }: Props) {
  const next = safeReturnTo((await searchParams).next)
  if (await retrieveCustomer().catch(() => null)) redirect(next)
  const loginHref = next === "/account" ? "/account/login" : `/account/login?next=${encodeURIComponent(next)}`

  return (
    <div className="max-w-[560px]">
      <h1 className={h1Class}>Create an account</h1>
      <p className={`mt-3 ${leadClass}`}>
        Optional: you can always check out as a guest. Already have an account?{" "}
        <Link href={loginHref} className={linkClass}>
          Sign in
        </Link>
        .
      </p>
      <div className="mt-8">
        <RegisterForm next={next} />
      </div>
    </div>
  )
}
