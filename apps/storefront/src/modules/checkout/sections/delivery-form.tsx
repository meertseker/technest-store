"use client"

import { AlertCircle, Store } from "lucide-react"
import { useActionState, useState } from "react"
import { formatGbp } from "@lib/basket/money"
import { DELIVERY_LABEL, choiceDescription, type DeliveryChoice } from "@lib/basket/shipping-options"
import { errorFor } from "@lib/checkout/validate"
import { saveDelivery, type CheckoutFormState } from "@lib/data/checkout-actions"
import { cn } from "@/lib/utils"
import AddonNotice from "@modules/basket/components/addon-notice"
import ErrorSummary from "./error-summary"
import SubmitButton from "./submit-button"
import TextField from "./text-field"

const fieldId = (f: string) => `delivery-${f}`

export type DeliveryDefaults = {
  option_id: string
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  city: string
  postal_code: string
}

/**
 * Step 2 (spec 7.5): the choice first (Collect from shop | Standard |
 * Next-day, with Medusa's prices), then only the fields that choice needs.
 * The address is asked only for delivery. Autocomplete tokens on every field.
 */
export default function DeliveryForm({
  choices,
  addonOnly,
  defaults,
  shopAddress,
}: {
  choices: DeliveryChoice[]
  addonOnly: boolean
  defaults: DeliveryDefaults
  shopAddress: string
}) {
  const [state, action] = useActionState(saveDelivery, {
    errors: [],
    values: defaults,
    submission: 0,
  } satisfies CheckoutFormState)
  const v = { ...defaults, ...state.values }
  const [optionId, setOptionId] = useState(v.option_id)
  const selected = choices.find((c) => c.id === optionId)
  const needsAddress = !!selected && selected.kind !== "collect"
  const err = (f: string) => errorFor(state.errors, f)
  const optionError = err("option")

  return (
    <form action={action} noValidate className="flex flex-col gap-6" data-testid="delivery-form">
      <ErrorSummary errors={state.errors} submission={state.submission} fieldId={fieldId} />

      {addonOnly && <AddonNotice />}

      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={optionError ? fieldId("option-error") : undefined}
      >
        <legend className="mb-3 text-lg font-semibold">How would you like to get your order?</legend>
        {optionError && (
          <p id={fieldId("option-error")} className="flex items-start gap-1.5 font-medium text-destructive">
            <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="sr-only">Error: </span>
              {optionError}
            </span>
          </p>
        )}
        {choices.length === 0 && (
          <p className="text-muted-foreground">
            We couldn&apos;t load delivery options. Please refresh the page or call the shop.
          </p>
        )}
        {choices.map((c, i) => {
          const blocked = !c.available || (addonOnly && c.kind !== "collect")
          const checked = optionId === c.id
          return (
            <label
              key={c.id}
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 rounded border p-4 transition-colors duration-150",
                checked ? "border-2 border-foreground bg-surface" : "border-border-strong hover:bg-surface",
                blocked && "cursor-not-allowed opacity-60 hover:bg-transparent"
              )}
              data-testid={`delivery-option-${c.kind}`}
            >
              <input
                id={i === 0 ? fieldId("option") : undefined}
                type="radio"
                name="option_id"
                value={c.id}
                // uncontrolled on purpose: React resets a form after its action runs,
                // and defaultChecked is what the reset restores
                defaultChecked={checked}
                disabled={blocked}
                onChange={() => setOptionId(c.id)}
                className="mt-0.5 size-5 shrink-0 accent-foreground"
              />
              <span className="flex flex-1 flex-col">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    {DELIVERY_LABEL[c.kind]}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {c.amount_pence === 0 ? "Free" : formatGbp(c.amount)}
                  </span>
                </span>
                {choiceDescription(c) && (
                  <span className="text-muted-foreground">{choiceDescription(c)}</span>
                )}
                {blocked && addonOnly && c.kind !== "collect" && (
                  <span className="text-muted-foreground">Not available for £1 items on their own</span>
                )}
              </span>
            </label>
          )
        })}
      </fieldset>

      {selected?.kind === "collect" && (
        <div className="flex gap-3 rounded border border-border bg-surface p-4" data-testid="collect-info">
          <Store aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>
            Collect from <strong className="font-semibold">{shopAddress}</strong>. We&apos;ll email you when
            it&apos;s ready. Bring your order email.
          </p>
        </div>
      )}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg font-semibold">
          {needsAddress ? "Delivery details" : "Your details"}
        </legend>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <TextField
            id={fieldId("first_name")}
            name="first_name"
            label="First name"
            autoComplete="given-name"
            defaultValue={v.first_name}
            error={err("first_name")}
            required
          />
          <TextField
            id={fieldId("last_name")}
            name="last_name"
            label="Last name"
            autoComplete="family-name"
            defaultValue={v.last_name}
            error={err("last_name")}
            required
          />
        </div>
        {needsAddress && (
          <>
            <TextField
              id={fieldId("address_1")}
              name="address_1"
              label="Address line 1"
              autoComplete="address-line1"
              defaultValue={v.address_1}
              error={err("address_1")}
              required
            />
            <TextField
              id={fieldId("address_2")}
              name="address_2"
              label="Address line 2"
              optional
              autoComplete="address-line2"
              defaultValue={v.address_2}
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField
                id={fieldId("city")}
                name="city"
                label="Town or city"
                autoComplete="address-level2"
                defaultValue={v.city}
                error={err("city")}
                required
              />
              <TextField
                id={fieldId("postal_code")}
                name="postal_code"
                label="Postcode"
                autoComplete="postal-code"
                autoCapitalize="characters"
                spellCheck={false}
                defaultValue={v.postal_code}
                error={err("postal_code")}
                className="md:max-w-48"
                required
              />
            </div>
            <p className="text-muted-foreground">We deliver to UK addresses only.</p>
          </>
        )}
        <TextField
          id={fieldId("phone")}
          name="phone"
          type="tel"
          label="Phone number"
          optional
          hint="Only used if there's a problem with your order."
          autoComplete="tel"
          defaultValue={v.phone}
          error={err("phone")}
        />
      </fieldset>

      <SubmitButton data-testid="delivery-continue">Continue to payment</SubmitButton>
    </form>
  )
}
