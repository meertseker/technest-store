"use client"

import { CheckCircle2 } from "lucide-react"
import { useActionState } from "react"
import { signup } from "@lib/data/customer"
import SubmitButton from "@modules/checkout/sections/submit-button"
import TextField from "@modules/checkout/sections/text-field"

/**
 * "Save your details? Create a password" (spec 7.5/7.6). Guest checkout stays the
 * default; this only offers an account afterwards, reusing the email and name
 * from the order so nothing is asked twice (WCAG 3.3.7).
 */
export default function CreateAccountOffer({
  email,
  firstName,
  lastName,
  phone,
}: {
  email: string
  firstName: string
  lastName: string
  phone: string
}) {
  const [state, action] = useActionState(signup, null)

  if (state?.state === "success" || state?.state === "verification_required") {
    return (
      <div role="status" className="flex gap-3 rounded border border-border bg-success-subtle p-4">
        <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        <p>
          {state.state === "success"
            ? "Your account is ready. Next time your details are filled in for you."
            : `Nearly done: we've emailed a link to ${state.email} to confirm your account.`}
        </p>
      </div>
    )
  }

  return (
    <section
      aria-labelledby="save-details-title"
      className="rounded border border-border p-4 md:p-6"
      data-testid="create-account-offer"
    >
      <h2 id="save-details-title" className="text-[22px] font-semibold leading-tight">
        Save your details?
      </h2>
      <p className="mt-2 text-muted-foreground">
        Create a password to track this order and check out faster next time.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-4">
        {/* username field for password managers; the value is the order email */}
        <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
        <input type="hidden" name="first_name" value={firstName} />
        <input type="hidden" name="last_name" value={lastName} />
        <input type="hidden" name="phone" value={phone} />
        <p>
          Account email: <strong className="font-semibold">{email}</strong>
        </p>
        <TextField
          id="new-password"
          name="password"
          type="password"
          label="Create a password"
          hint="At least 8 characters."
          autoComplete="new-password"
          minLength={8}
          required
          error={state?.state === "error" ? "We couldn't create your account. Try a different password, or sign in if you already have an account." : undefined}
        />
        <SubmitButton>Create account</SubmitButton>
      </form>
    </section>
  )
}
