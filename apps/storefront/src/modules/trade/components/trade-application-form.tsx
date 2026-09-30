"use client"

import Link from "next/link"
import ErrorSummary from "@/components/forms/error-summary"
import { RadioGroup, TextField } from "@/components/forms/field"
import SubmitButton from "@/components/forms/submit-button"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import { submitTradeApplication } from "@lib/data/trade-actions"
import { initialFormState } from "@/lib/forms/state"
import { BUSINESS_TYPES, TRADE_FIELDS, validateTradeApplication, type FormValues } from "@/lib/forms/validation"

/** POST /store/trade-applications (signed-in customers only; docs/contracts/trade.md) */
export default function TradeApplicationForm({ initial }: { initial: FormValues }) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(
    submitTradeApplication,
    validateTradeApplication,
    TRADE_FIELDS,
    { ...initialFormState, values: initial }
  )
  const v = state.values
  const e = state.errors

  return (
    <form key={serverState.attempt} action={formAction} onSubmit={onSubmit} noValidate className="flex max-w-[560px] flex-col gap-8">
      <ErrorSummary errors={e} formError={state.formError} trigger={state} order={TRADE_FIELDS} />

      <fieldset className="flex flex-col gap-6">
        <legend className="text-[22px] font-semibold leading-tight">Your business</legend>
        <TextField
          name="company_name"
          label="Business name"
          hint="As it appears on invoices."
          autoComplete="organization"
          defaultValue={v.company_name}
          error={e.company_name}
        />
        <RadioGroup
          name="business_type"
          label="Type of business"
          options={BUSINESS_TYPES}
          defaultValue={v.business_type}
          error={e.business_type}
        />
        <TextField
          name="vat_number"
          label="VAT number"
          optional
          hint="If you are VAT registered, for example GB123456789."
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={v.vat_number}
          error={e.vat_number}
          className="sm:max-w-[320px]"
        />
        <TextField
          name="companies_house_number"
          label="Companies House number"
          optional
          hint="For limited companies: 8 characters, for example 01234567 or SC123456."
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={v.companies_house_number}
          error={e.companies_house_number}
          className="sm:max-w-[320px]"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-[22px] font-semibold leading-tight">Who should we contact?</legend>
        <TextField name="contact_name" label="Full name" autoComplete="name" defaultValue={v.contact_name} error={e.contact_name} />
        <TextField
          name="contact_phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          defaultValue={v.contact_phone}
          error={e.contact_phone}
        />
        <TextField
          name="contact_email"
          label="Email address"
          hint="We send the decision here."
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={v.contact_email}
          error={e.contact_email}
        />
      </fieldset>

      <p className="text-muted-foreground">
        We use these details only to check and run your trade account. See our{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
      <SubmitButton pendingText="Sending application…">Send application</SubmitButton>
    </form>
  )
}
