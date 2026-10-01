"use client"

import Link from "next/link"
import { CircleAlert } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import Notice from "@/components/ui/notice"
import { h1Class } from "@/lib/typography"
import { confirmEmailVerification } from "@lib/data/customer"

type VerificationState = "verifying" | "success" | "error"

/** The page behind the link in the "verify your email" message */
const VerifyAccount = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerificationState>("verifying")
  // Guard against the effect running twice in React Strict Mode, which would
  // consume the single-use token before the customer sees the result.
  const confirmed = useRef(false)

  useEffect(() => {
    if (confirmed.current) {
      return
    }
    confirmed.current = true

    if (!token) {
      setState("error")
      return
    }

    confirmEmailVerification(token).then(({ success }) =>
      setState(success ? "success" : "error")
    )
  }, [token])

  return (
    <div className="content-container max-w-xl py-10 lg:py-14" data-testid="verify-account-page">
      <h1 className={h1Class}>Verify your email</h1>

      {state === "verifying" && (
        <p role="status" className="mt-4 text-muted-foreground">
          Checking your link…
        </p>
      )}

      {state === "success" && (
        <>
          <Notice tone="success" title="Your email is verified" className="mt-6">
            You can now sign in to your account.
          </Notice>
          <Link href="/account/login" className={buttonVariants({ className: "mt-6 w-full sm:w-auto" })}>
            Sign in
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <div role="alert" className="mt-6 flex gap-3 rounded border border-destructive p-4">
            <CircleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-destructive" />
            <p>This link is invalid or has expired. Sign in and we will send you a new one.</p>
          </div>
          <Link
            href="/account/login"
            className={buttonVariants({ variant: "secondary", className: "mt-6 w-full sm:w-auto" })}
          >
            Go to sign in
          </Link>
        </>
      )}
    </div>
  )
}

export default VerifyAccount
