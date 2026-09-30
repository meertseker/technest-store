/**
 * Checkout form validation (spec 8: specific messages, shown inline and in the
 * error summary). Messages follow the GOV.UK pattern: say what to do.
 */
import { isValidUkPostcode } from "./postcode"
import type { DeliveryKind } from "@lib/basket/shipping-options"

export type FieldError = { field: string; message: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[0-9][0-9\s()-]{6,19}$/

export function validateContact(input: { email: string }): FieldError[] {
  const email = input.email.trim()
  if (!email) return [{ field: "email", message: "Enter your email address" }]
  if (!EMAIL.test(email)) {
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
  if (!input.first_name.trim()) errors.push({ field: "first_name", message: "Enter your first name" })
  if (!input.last_name.trim()) errors.push({ field: "last_name", message: "Enter your last name" })
  if (input.phone.trim() && !PHONE.test(input.phone.trim())) {
    errors.push({ field: "phone", message: "Enter a phone number, like 07700 900982" })
  }
  if (input.kind && input.kind !== "collect") {
    if (!input.address_1.trim()) {
      errors.push({ field: "address_1", message: "Enter the first line of your address" })
    }
    if (!input.city.trim()) errors.push({ field: "city", message: "Enter your town or city" })
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
