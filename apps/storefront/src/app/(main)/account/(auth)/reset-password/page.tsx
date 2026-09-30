import { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { h1Class, leadClass } from "@/lib/typography"
import { ResetPasswordForm } from "@modules/account/components/password-reset-forms"

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  // The token is in the URL: never send it to another site in a Referer header
  referrer: "no-referrer",
}

/** E2's reset email links here: /account/reset-password?token=...&email=... (docs/contracts/emails.md) */
type Props = { searchParams: Promise<{ token?: string; email?: string }> }

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token, email } = await searchParams
  const validEmail = typeof email === "string" && email.length <= 254 ? email : undefined

  if (typeof token !== "string" || !token) {
    return (
      <div className="max-w-[560px]">
        <h1 className={h1Class}>This link is not complete</h1>
        <p className={`mt-3 ${leadClass}`}>
          Open the link from the email again, or copy the whole link into your browser. If it still does not work, ask
          for a new one.
        </p>
        <Link href="/account/forgot-password" className={buttonVariants({ className: "mt-6 w-full sm:w-auto" })}>
          Ask for a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[560px]">
      <h1 className={h1Class}>Choose a new password</h1>
      {validEmail && (
        <p className={`mt-3 ${leadClass}`}>
          For <strong className="break-all">{validEmail}</strong>
        </p>
      )}
      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  )
}
