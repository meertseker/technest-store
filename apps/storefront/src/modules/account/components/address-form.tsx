"use client"

import Link from "next/link"
import ErrorSummary from "@/components/forms/error-summary"
import { CheckboxField, TextField } from "@/components/forms/field"
import SubmitButton from "@/components/forms/submit-button"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import { saveAddressAction } from "@lib/data/account-actions"
import { initialFormState } from "@/lib/forms/state"
import { ADDRESS_FIELDS, validateAddress, type FormValues } from "@/lib/forms/validation"

/** Add or edit a UK address (we deliver in the UK only, so there is no country field) */
export default function AddressForm({ addressId, initial }: { addressId?: string; initial?: FormValues }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(saveAddressAction, validateAddress, ADDRESS_FIELDS, {
    ...initialFormState,
    values: initial ?? {},
  })
  const v = state.values
  const e = state.errors

  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex max-w-[560px] flex-col gap-6">
      <ErrorSummary errors={e} formError={state.formError} trigger={state} order={ADDRESS_FIELDS} />
      {addressId && <input type="hidden" name="address_id" value={addressId} />}
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField name="first_name" label="First name" autoComplete="given-name" defaultValue={v.first_name} error={e.first_name} />
        <TextField name="last_name" label="Last name" autoComplete="family-name" defaultValue={v.last_name} error={e.last_name} />
      </div>
      <TextField name="company" label="Company" optional autoComplete="organization" defaultValue={v.company} error={e.company} />
      <TextField name="address_1" label="Address line 1" autoComplete="address-line1" defaultValue={v.address_1} error={e.address_1} />
      <TextField name="address_2" label="Address line 2" optional autoComplete="address-line2" defaultValue={v.address_2} error={e.address_2} />
      <TextField
        name="city"
        label="Town or city"
        autoComplete="address-level2"
        defaultValue={v.city}
        error={e.city}
        className="sm:max-w-[320px]"
      />
      <TextField
        name="postal_code"
        label="Postcode"
        autoComplete="postal-code"
        autoCapitalize="characters"
        spellCheck={false}
        defaultValue={v.postal_code}
        error={e.postal_code}
        className="max-w-[200px]"
      />
      <TextField
        name="phone"
        label="Phone number"
        optional
        hint="For the courier, if they need to reach you."
        type="tel"
        autoComplete="tel"
        defaultValue={v.phone}
        error={e.phone}
      />
      <CheckboxField
        name="is_default_shipping"
        label="Use this as my main delivery address"
        defaultChecked={v.is_default_shipping === "yes"}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pendingText="Saving…">{addressId ? "Save changes" : "Save address"}</SubmitButton>
        <Link href="/account/addresses" className="inline-flex min-h-11 items-center justify-center px-4 underline underline-offset-4">
          Cancel
        </Link>
      </div>
    </form>
  )
}
