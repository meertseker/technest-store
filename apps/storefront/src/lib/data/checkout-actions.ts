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
import { reportUnexpected } from "@lib/monitoring/report"
import { siteConfig } from "@lib/site-config"
import { TRADE_ACCOUNT_EMAIL_MESSAGE, isTradeAccountEmailRefusal } from "@lib/util/address-error"
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
  } catch (e) {
    const message = isTradeAccountEmailRefusal(e) ? TRADE_ACCOUNT_EMAIL_MESSAGE : SERVICE_ERROR
    await reportUnexpected(e, "checkout.contact")
    return { errors: [{ field: "email", message }], values, submission: Date.now() }
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

  let cart: Awaited<ReturnType<typeof retrieveCart>>
  try {
    cart = await retrieveCart(undefined, CHECKOUT_CART_FIELDS)
  } catch (e) {
    // the backend could not answer: keep what was typed and let the shopper retry
    await reportUnexpected(e, "checkout.delivery")
    return fail([{ field: "option", message: SERVICE_ERROR }])
  }
  if (!cart?.items?.length) redirect("/basket")

  // Only an option this cart really offers can be chosen; its kind comes from Medusa
  const view = await getBasketView(cart)
  const choice = view.choices.find((c) => c.id === optionId && c.available)
  input.kind = (choice?.kind ?? "") as DeliveryKind | ""
  values.kind = input.kind

  const errors = validateDelivery(input, { addonOnly: view.addon_only })
  if (!errors.length && input.kind && input.kind !== "collect") {
    // The lookup's data is published quarterly, so a brand-new postcode is
    // missing from it. The first time we ask the shopper to check; when the
    // same (correctly formatted) postcode comes back, we take their word.
    const postcode = normalisePostcode(input.postal_code)
    const confirmed = text(formData, "postcode_confirmed") === postcode
    if (!confirmed && !(await postcodeExists(postcode))) {
      values.postcode_confirmed = postcode
      errors.push({
        field: "postal_code",
        message:
          "We can't find that postcode. Check it. If it is correct (for example a new building), select Continue to payment again to use it",
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

  // Two calls, and Medusa has no call to take a method off a basket, so the
  // order is chosen to make every failure leave a consistent basket:
  // - with a method already set: the method first (the call the backend can
  //   refuse: a basket rule, an option that no longer applies). If the address
  //   save then fails, the previous method is put back.
  // - without one: the address first. If the method is then refused, the
  //   basket has an address and no method, so the step stays unfinished.
  const newOptionId = choice!.id
  const previousOptionId = cart.shipping_methods?.[0]?.shipping_option_id ?? null
  let updated: HttpTypes.StoreCart
  try {
    if (previousOptionId) {
      await setShippingMethod({ cartId: cart.id, shippingMethodId: newOptionId })
      try {
        updated = await updateCart({ shipping_address, billing_address })
      } catch (e) {
        if (previousOptionId !== newOptionId) {
          await setShippingMethod({ cartId: cart.id, shippingMethodId: previousOptionId }).catch((restoreError) =>
            reportUnexpected(restoreError, "checkout.delivery-restore")
          )
        }
        throw e
      }
    } else {
      updated = await updateCart({ shipping_address, billing_address })
      await setShippingMethod({ cartId: cart.id, shippingMethodId: newOptionId })
    }
  } catch (e) {
    await reportUnexpected(e, "checkout.delivery")
    return fail([{ field: "option", message: SERVICE_ERROR }])
  }
  redirect(nextStepUrl({ ...updated, shipping_methods: [{}], shipping_address }))
}
