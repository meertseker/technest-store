"use client"

import { useActionState } from "react"
import { errorFor } from "@lib/checkout/validate"
import { saveContact, type CheckoutFormState } from "@lib/data/checkout-actions"
import ErrorSummary from "./error-summary"
import SubmitButton from "./submit-button"
import TextField from "./text-field"

const fieldId = (f: string) => `contact-${f}`

/** Step 1: email only (guest checkout). "Have an account? Sign in" is a full page load out of checkout. */
export default function ContactForm({ email }: { email: string }) {
  const [state, action] = useActionState(saveContact, {
    errors: [],
    values: { email },
    submission: 0,
  } satisfies CheckoutFormState)

  return (
    <form action={action} noValidate className="flex flex-col gap-5" data-testid="contact-form">
      <ErrorSummary errors={state.errors} submission={state.submission} fieldId={fieldId} />
      <TextField
        id={fieldId("email")}
        name="email"
        type="email"
        label="Email address"
        hint="We'll send your order confirmation here."
        autoComplete="email"
        spellCheck={false}
        defaultValue={state.values.email}
        error={errorFor(state.errors, "email")}
        required
      />
      <p>
        Have an account?{" "}
        <a href="/account" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:decoration-2">
          Sign in
        </a>
      </p>
      <SubmitButton data-testid="contact-continue">Continue to delivery</SubmitButton>
    </form>
  )
}
