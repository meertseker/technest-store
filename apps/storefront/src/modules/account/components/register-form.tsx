"use client"

import Link from "next/link"
import ErrorSummary from "@/components/forms/error-summary"
import { TextField } from "@/components/forms/field"
import PasswordField from "@/components/forms/password-field"
import SubmitButton from "@/components/forms/submit-button"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import Notice from "@/components/ui/notice"
import { registerAction } from "@lib/data/account-actions"
import { PASSWORD_MIN, REGISTER_FIELDS, validateRegister } from "@/lib/forms/validation"

export default function RegisterForm({ next }: { next: string }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(registerAction, validateRegister, REGISTER_FIELDS)

  if (state.status === "success" && state.message === "verify") {
    return (
      <Notice tone="success" title="Check your email">
        We have sent you a link to confirm your email address. Open it to finish creating your account.
      </Notice>
    )
  }

  const v = state.values
  const e = state.errors
  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={e} formError={state.formError} trigger={state} order={REGISTER_FIELDS} />
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField name="first_name" label="First name" autoComplete="given-name" defaultValue={v.first_name} error={e.first_name} />
        <TextField name="last_name" label="Last name" autoComplete="family-name" defaultValue={v.last_name} error={e.last_name} />
      </div>
      <TextField
        name="email"
        label="Email address"
        hint="We send your order updates here."
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={v.email}
        error={e.email}
      />
      <TextField
        name="phone"
        label="Phone number"
        optional
        hint="Only used if we need to call you about an order or collection."
        type="tel"
        autoComplete="tel"
        defaultValue={v.phone}
        error={e.phone}
      />
      <PasswordField
        name="password"
        label="Create a password"
        hint={`At least ${PASSWORD_MIN} characters. A few random words are easy to remember and hard to guess.`}
        autoComplete="new-password"
        error={e.password}
      />
      <p className="text-muted-foreground">
        We use your details to run your account and orders, as explained in our{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
    </form>
  )
}
