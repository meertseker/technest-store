"use client"

import ErrorSummary from "@/components/forms/error-summary"
import { TextField } from "@/components/forms/field"
import SubmitButton from "@/components/forms/submit-button"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import Notice from "@/components/ui/notice"
import { updateProfileAction } from "@lib/data/account-actions"
import { initialFormState } from "@/lib/forms/state"
import { PROFILE_FIELDS, validateProfile, type FormValues } from "@/lib/forms/validation"

export default function ProfileForm({ initial }: { initial: FormValues }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(updateProfileAction, validateProfile, PROFILE_FIELDS, {
    ...initialFormState,
    values: initial,
  })
  const v = state.values
  const e = state.errors
  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex max-w-[560px] flex-col gap-6">
      <ErrorSummary errors={e} formError={state.formError} trigger={state} order={PROFILE_FIELDS} />
      {state.status === "success" && state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField name="first_name" label="First name" autoComplete="given-name" defaultValue={v.first_name} error={e.first_name} />
        <TextField name="last_name" label="Last name" autoComplete="family-name" defaultValue={v.last_name} error={e.last_name} />
      </div>
      <TextField
        name="phone"
        label="Phone number"
        optional
        hint="Only used if we need to call you about an order, collection or repair."
        type="tel"
        autoComplete="tel"
        defaultValue={v.phone}
        error={e.phone}
      />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save details
      </SubmitButton>
    </form>
  )
}
