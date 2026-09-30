"use client"

import Link from "next/link"
import ErrorSummary from "@/components/forms/error-summary"
import {
  CheckboxField,
  RadioGroup,
  TextAreaField,
  TextField,
} from "@/components/forms/field"
import SubmitButton from "@/components/forms/submit-button"
import Turnstile from "@/components/forms/turnstile"
import { useValidatedForm } from "@/components/forms/use-validated-form"
import { buttonVariants } from "@/components/ui/button"
import { submitRepairBooking } from "@lib/data/repair-actions"
import type { Device, DeviceTree } from "@/lib/devices/types"
import { initialFormState } from "@/lib/forms/state"
import {
  PREFERRED_TIMES,
  REPAIR_FIELDS,
  londonToday,
  validateRepairBooking,
  type FormValues,
} from "@/lib/forms/validation"
import DeviceField from "./device-field"
import { CheckCircle2 } from "lucide-react"
import { useEffect, useRef } from "react"

const ORDER = [...REPAIR_FIELDS, "security_check"]

type Props = {
  tree: DeviceTree
  currentDevice: Pick<Device, "id" | "model"> | null
  initial?: FormValues
  phone: { display: string; e164: string }
}

/** POST /store/repair-bookings (docs/contracts/repairs.md), no login needed */
export default function RepairBookingForm({
  tree,
  currentDevice,
  initial,
  phone,
}: Props) {
  const { state, serverState, formAction, onSubmit } = useValidatedForm(
    submitRepairBooking,
    (v) => validateRepairBooking(v),
    REPAIR_FIELDS,
    { ...initialFormState, values: initial ?? {} }
  )

  if (state.status === "success") {
    return (
      <Success
        name={state.values.name}
        customerPhone={state.values.phone}
        phone={phone}
      />
    )
  }

  const v = state.values
  const e = state.errors
  return (
    <form
      key={serverState.attempt}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex max-w-[640px] flex-col gap-8"
    >
      <ErrorSummary
        errors={e}
        formError={state.formError}
        trigger={state}
        order={ORDER}
      />

      <fieldset className="flex flex-col gap-6">
        <legend className="text-[22px] font-semibold leading-tight">
          About your device
        </legend>
        <DeviceField
          tree={tree}
          defaultDevice={v.device === undefined ? currentDevice : null}
          defaultText={v.device}
          defaultId={v.device_id}
          error={e.device ?? e.device_id}
        />
        <TextAreaField
          name="fault"
          label="What is wrong with it?"
          hint="For example: cracked screen but touch still works, or it will not charge."
          maxLength={2000}
          defaultValue={v.fault}
          error={e.fault}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-[22px] font-semibold leading-tight">
          When suits you?
        </legend>
        <p className="text-muted-foreground">
          A rough idea is enough. We will call to agree an exact time.
        </p>
        <TextField
          name="preferred_day"
          label="Preferred day"
          optional
          hint="Leave blank if any day is fine."
          type="date"
          min={londonToday()}
          defaultValue={v.preferred_day}
          error={e.preferred_day}
          className="max-w-[240px]"
        />
        <RadioGroup
          name="preferred_time"
          label="Time of day"
          options={PREFERRED_TIMES}
          defaultValue={v.preferred_time ?? "any"}
          error={e.preferred_time}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-[22px] font-semibold leading-tight">
          Your details
        </legend>
        <TextField
          name="name"
          label="Name"
          autoComplete="name"
          defaultValue={v.name}
          error={e.name}
        />
        <TextField
          name="phone"
          label="Phone number"
          hint="We will call you on this number."
          type="tel"
          autoComplete="tel"
          defaultValue={v.phone}
          error={e.phone}
        />
        <TextField
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={v.email}
          error={e.email}
        />
      </fieldset>

      <CheckboxField
        name="consent"
        defaultChecked={v.consent === "yes"}
        error={e.consent}
        label="Tech Nest can use these details to contact me about this repair"
        hint={
          <>
            How we use and keep your details is in our{" "}
            <Link
              href="/legal/privacy"
              className="underline underline-offset-4"
            >
              privacy notice
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/repair-terms"
              className="underline underline-offset-4"
            >
              repair terms
            </Link>
            .
          </>
        }
      />

      <Turnstile resetKey={serverState} error={e.security_check} />

      <SubmitButton pendingText="Sending your request…">
        Send repair request
      </SubmitButton>
    </form>
  )
}

/** Replaces the form; takes focus so screen readers announce it and it scrolls into view */
function Success({
  name,
  customerPhone,
  phone,
}: {
  name?: string
  customerPhone?: string
  phone: Props["phone"]
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="booked"
      className="rounded border border-success bg-success-subtle p-6 outline-none"
      data-testid="repair-success"
    >
      <h2
        id="booked"
        className="flex items-center gap-2 text-[22px] font-semibold leading-tight lg:text-[28px]"
      >
        <CheckCircle2 aria-hidden className="size-7 text-success" />
        Thanks{name ? `, ${name}` : ""}. We have your request
      </h2>
      <p className="mt-3 max-w-[68ch]">
        We will call you on <strong>{customerPhone}</strong> to agree a time and
        give you a price. Nothing is booked or charged until we have spoken.
      </p>
      <p className="mt-2 max-w-[68ch]">
        In a hurry? Call us on{" "}
        <a
          href={`tel:${phone.e164}`}
          className="font-semibold underline underline-offset-4"
        >
          {phone.display}
        </a>
        .
      </p>
      <Link
        href="/"
        className={buttonVariants({
          variant: "secondary",
          className: "mt-6 w-full sm:w-auto",
        })}
      >
        Back to the shop
      </Link>
    </section>
  )
}
