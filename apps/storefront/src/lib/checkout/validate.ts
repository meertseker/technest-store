/**
 * Checkout form validation (spec 8: specific messages, shown inline and in the
 * error summary). Messages follow the GOV.UK pattern: say what to do.
 */
import { isValidUkPostcode } from "./postcode"
import type { DeliveryKind } from "@lib/basket/shipping-options"

export type FieldError = { field: string; message: string }

/**
 * Longest values Stripe's billing details and the backend accept without a
 * generic error. The inputs carry them as `maxLength`; the server checks again.
 */
export const LIMITS = { email: 254, name: 100, address: 200, phone: 40 } as const

// local part: dot-separated atoms of ordinary address characters (no leading,
// trailing or doubled dots); domain: hyphenated labels and a TLD of letters
const EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/
const PHONE = /^\+?[0-9][0-9\s()-]{6,19}$/

const tooLong = (label: string, max: number) => `${label} must be ${max} characters or fewer`

function isEmailShape(email: string): boolean {
  const at = email.lastIndexOf("@")
  return at > 0 && at <= 64 && EMAIL.test(email)
}

export function validateContact(input: { email: string }): FieldError[] {
  const email = input.email.trim()
  if (!email) return [{ field: "email", message: "Enter your email address" }]
  if (email.length > LIMITS.email) {
    return [{ field: "email", message: tooLong("Email address", LIMITS.email) }]
  }
  if (!isEmailShape(email)) {
    return [
      {
        field: "email",
        message: "Enter an email address in the correct format, like name@example.com",
      },
    ]
  }
  return []
}

export type DeliveryInput = {
  kind: DeliveryKind | ""
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  city: string
  postal_code: string
}

export function validateDelivery(
  input: DeliveryInput,
  opts: { addonOnly?: boolean } = {}
): FieldError[] {
  const errors: FieldError[] = []
  if (!input.kind) {
    errors.push({ field: "option", message: "Choose how you'd like to get your order" })
  } else if (input.kind !== "collect" && opts.addonOnly) {
    errors.push({
      field: "option",
      message: "£1 items can't be delivered on their own. Choose Collect from shop, or add another item",
    })
  }
  const first = input.first_name.trim()
  const last = input.last_name.trim()
  if (!first) errors.push({ field: "first_name", message: "Enter your first name" })
  else if (first.length > LIMITS.name) errors.push({ field: "first_name", message: tooLong("First name", LIMITS.name) })
  if (!last) errors.push({ field: "last_name", message: "Enter your last name" })
  else if (last.length > LIMITS.name) errors.push({ field: "last_name", message: tooLong("Last name", LIMITS.name) })
  const phone = input.phone.trim()
  if (phone && (phone.length > LIMITS.phone || !PHONE.test(phone))) {
    errors.push({ field: "phone", message: "Enter a phone number, like 07700 900982" })
  }
  if (input.kind && input.kind !== "collect") {
    const line1 = input.address_1.trim()
    const line2 = input.address_2.trim()
    const city = input.city.trim()
    if (!line1) {
      errors.push({ field: "address_1", message: "Enter the first line of your address" })
    } else if (line1.length > LIMITS.address) {
      errors.push({ field: "address_1", message: tooLong("Address line 1", LIMITS.address) })
    }
    if (line2.length > LIMITS.address) {
      errors.push({ field: "address_2", message: tooLong("Address line 2", LIMITS.address) })
    }
    if (!city) errors.push({ field: "city", message: "Enter your town or city" })
    else if (city.length > LIMITS.address) errors.push({ field: "city", message: tooLong("Town or city", LIMITS.address) })
    if (!input.postal_code.trim()) {
      errors.push({ field: "postal_code", message: "Enter your postcode" })
    } else if (!isValidUkPostcode(input.postal_code)) {
      errors.push({ field: "postal_code", message: "Enter a full UK postcode, like SE16 3TU" })
    }
  }
  return errors
}

export function errorFor(errors: readonly FieldError[] | undefined, field: string) {
  return errors?.find((e) => e.field === field)?.message
}
