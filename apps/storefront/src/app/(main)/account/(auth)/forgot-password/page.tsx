import { Metadata } from "next"
import Link from "next/link"
import { h1Class, leadClass, linkClass } from "@/lib/typography"
import { retrieveCustomer } from "@lib/data/customer"
import { ForgotPasswordForm } from "@modules/account/components/password-reset-forms"

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to reset your Tech Nest account password.",
  robots: { index: false },
}

export default async function ForgotPasswordPage() {
  // Signed in (e.g. "Change password" on Your details): no need to type it again (WCAG 3.3.7)
  const email = (await retrieveCustomer().catch(() => null))?.email
  return (
    <div className="max-w-[560px]">
      <h1 className={h1Class}>Reset your password</h1>
      <p className={`mt-3 ${leadClass}`}>Enter your email address and we will send you a link to choose a new password.</p>
      <div className="mt-8">
        <ForgotPasswordForm defaultEmail={email} />
      </div>
      <p className="mt-8">
        Remembered it?{" "}
        <Link href="/account/login" className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
