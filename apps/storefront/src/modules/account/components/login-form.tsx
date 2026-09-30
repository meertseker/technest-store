"use client"

import Link from "next/link"
import ErrorSummary from "@/components/forms/error-summary"
import { TextField } from "@/components/forms/field"
import PasswordField from "@/components/forms/password-field"
import SubmitButton from "@/components/forms/submit-button"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import Notice from "@/components/ui/notice"
import { loginAction } from "@lib/data/account-actions"
import { LOGIN_FIELDS, validateLogin } from "@/lib/forms/validation"

export default function LoginForm({ next }: { next: string }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(loginAction, validateLogin, LOGIN_FIELDS)

  if (state.status === "success" && state.message === "verify") {
    return (
      <Notice tone="success" title="Check your email">
        We have sent you a link to confirm your email address. Open it, then sign in again.
      </Notice>
    )
  }

  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={state.errors} formError={state.formError} trigger={state} order={LOGIN_FIELDS} />
      <input type="hidden" name="next" value={next} />
      <TextField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.values.email}
        error={state.errors.email}
      />
      <div>
        <PasswordField name="password" label="Password" autoComplete="current-password" error={state.errors.password} />
        <Link
          href="/account/forgot-password"
          className="mt-1 inline-flex min-h-11 items-center underline underline-offset-4 hover:decoration-2"
        >
          Forgotten your password?
        </Link>
      </div>
      <SubmitButton pendingText="Signing in…" data-testid="sign-in-button">
        Sign in
      </SubmitButton>
    </form>
  )
}
