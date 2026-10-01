import { Metadata } from "next"
import { Suspense } from "react"

import VerifyAccount from "@modules/account/components/verify-account"

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Verify your email address to complete your registration.",
  robots: { index: false, follow: false },
}

export default function VerifyAccountPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="content-container max-w-xl py-10 text-muted-foreground lg:py-14">
          Checking your link…
        </p>
      }
    >
      <VerifyAccount />
    </Suspense>
  )
}
