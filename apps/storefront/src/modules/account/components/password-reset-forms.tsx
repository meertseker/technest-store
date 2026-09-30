"use client"

import Link from "next/link"
import ErrorSummary from "@/components/forms/error-summary"
import { TextField } from "@/components/forms/field"
import PasswordField from "@/components/forms/password-field"
import SubmitButton from "@/components/forms/submit-button"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import Notice from "@/components/ui/notice"
import { forgotPasswordAction, resetPasswordAction } from "@lib/data/account-actions"
import { FORGOT_FIELDS, PASSWORD_MIN, RESET_FIELDS, validateForgot, validateReset } from "@/lib/forms/validation"

export function ForgotPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(forgotPasswordAction, validateForgot, FORGOT_FIELDS)

  if (state.status === "success") {
    return (
      <Notice tone="success" title="Check your email">
        <p>
          If there is an account for <strong className="break-all">{state.values.email}</strong>, we have sent it a link
          to reset your password. The link works once and expires after a short time.
        </p>
        <p className="mt-2">Nothing arrived after 10 minutes? Check your spam folder, or ask for another link.</p>
      </Notice>
    )
  }

  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={state.errors} formError={state.formError} trigger={state} order={FORGOT_FIELDS} />
      <TextField
        name="email"
        label="Email address"
        hint="The one you use to sign in."
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.values.email ?? defaultEmail}
        error={state.errors.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  )
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(resetPasswordAction, validateReset, RESET_FIELDS)

  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={state.errors} formError={state.formError} trigger={state} order={RESET_FIELDS} />
      {state.formError && (
        <Link
          href="/account/forgot-password"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Ask for a new reset link
        </Link>
      )}
      <input type="hidden" name="token" value={token} />
      <PasswordField
        name="password"
        label="New password"
        hint={`At least ${PASSWORD_MIN} characters.`}
        autoComplete="new-password"
        error={state.errors.password}
      />
      <PasswordField
        name="confirm_password"
        label="Type the new password again"
        autoComplete="new-password"
        error={state.errors.confirm_password}
      />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  )
}
