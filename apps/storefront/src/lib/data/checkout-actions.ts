"use server"

import { STORE_COUNTRY } from "@lib/constants/store"
import { normalisePostcode, postcodeExists } from "@lib/checkout/postcode"
import { firstIncompleteStep } from "@lib/checkout/steps"
import {
  validateContact,
  validateDelivery,
  type DeliveryInput,
  type FieldError,
} from "@lib/checkout/validate"
import type { DeliveryKind } from "@lib/basket/shipping-options"
import { siteConfig } from "@lib/site-config"
import { HttpTypes } from "@medusajs/types"
import { redirect } from "next/navigation"
import { CHECKOUT_CART_FIELDS, getBasketView } from "./basket"
import { retrieveCart, setShippingMethod, updateCart } from "./cart"

/**
 * Checkout form actions (spec 7.5). Each returns field errors for the error
 * summary, or redirects to the next incomplete step. `submission` changes on
 * every submit so the summary takes focus once per submit (spec 8).
 */
export type CheckoutFormState = {
  errors: FieldError[]
  values: Record<string, string>
  submission: number
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim()

const SERVICE_ERROR = "Something went wrong saving your details. Please try again."

function nextStepUrl(cart: Parameters<typeof firstIncompleteStep>[0]) {
  return `/checkout?step=${firstIncompleteStep(cart)}`
}

export async function saveContact(
  _prev: CheckoutFormState,
  formData: FormData
): Promise<CheckoutFormState> {
  const values = { email: text(formData, "email") }
  const errors = validateContact(values)
  if (errors.length) return { errors, values, submission: Date.now() }

  let cart: HttpTypes.StoreCart
  try {
    cart = await updateCart({ email: values.email })
  } catch {
    return { errors: [{ field: "email", message: SERVICE_ERROR }], values, submission: Date.now() }
  }
  redirect(nextStepUrl(cart))
}

export async function saveDelivery(
  _prev: CheckoutFormState,
  formData: FormData
): Promise<CheckoutFormState> {
  const optionId = text(formData, "option_id")
  const input: DeliveryInput = {
    kind: "",
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    phone: text(formData, "phone"),
    address_1: text(formData, "address_1"),
    address_2: text(formData, "address_2"),
    city: text(formData, "city"),
    postal_code: text(formData, "postal_code"),
  }
  const values: Record<string, string> = { ...input, option_id: optionId }
  const fail = (errors: FieldError[]) => ({ errors, values, submission: Date.now() })

  const cart = await retrieveCart(undefined, CHECKOUT_CART_FIELDS)
  if (!cart?.items?.length) redirect("/basket")

  // Only an option this cart really offers can be chosen; its kind comes from Medusa
  const view = await getBasketView(cart)
  const choice = view.choices.find((c) => c.id === optionId && c.available)
  input.kind = (choice?.kind ?? "") as DeliveryKind | ""
  values.kind = input.kind

  const errors = validateDelivery(input, { addonOnly: view.addon_only })
  if (!errors.length && input.kind && input.kind !== "collect") {
    if (!(await postcodeExists(input.postal_code))) {
      errors.push({
        field: "postal_code",
        message: "We can't find that postcode. Check it and try again",
      })
    }
  }
  if (errors.length) return fail(errors)

  const person = {
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
  }
  const shipping_address: HttpTypes.StoreAddAddress =
    input.kind === "collect"
      ? {
          // Click & Collect: the parcel "ships" to the shop, labelled with the customer's name
          ...person,
          company: siteConfig.name,
          address_1: `${siteConfig.address.line1}, ${siteConfig.address.line2}`,
          city: siteConfig.address.locality,
          postal_code: siteConfig.address.postcode,
          country_code: STORE_COUNTRY,
        }
      : {
          ...person,
          address_1: input.address_1,
          address_2: input.address_2,
          city: input.city,
          postal_code: normalisePostcode(input.postal_code),
          country_code: STORE_COUNTRY,
        }
  // No separate billing form: delivery orders bill to the delivery address;
  // collection orders send only the name (Stripe collects what the card needs).
  const billing_address: HttpTypes.StoreAddAddress =
    input.kind === "collect" ? { ...person, country_code: STORE_COUNTRY } : shipping_address

  let updated: HttpTypes.StoreCart
  try {
    updated = await updateCart({ shipping_address, billing_address })
    await setShippingMethod({ cartId: cart.id, shippingMethodId: choice!.id })
  } catch {
    return fail([{ field: "option", message: SERVICE_ERROR }])
  }
  redirect(nextStepUrl({ ...updated, shipping_methods: [{}], shipping_address }))
}
