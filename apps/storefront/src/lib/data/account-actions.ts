"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { loginErrorMessage, registerErrorMessage } from "@/lib/forms/auth-messages"
import { errorState, safeReturnTo, withoutSecrets, type FormState } from "@/lib/forms/state"
import {
  ADDRESS_FIELDS,
  FORGOT_FIELDS,
  LOGIN_FIELDS,
  PROFILE_FIELDS,
  REGISTER_FIELDS,
  RESET_FIELDS,
  formatUkPostcode,
  hasErrors,
  readForm,
  validateAddress,
  validateForgot,
  validateLogin,
  validateProfile,
  validateRegister,
  validateReset,
} from "@/lib/forms/validation"
import { getAuthHeaders, getCacheTag } from "./cookies"
import { login, signup } from "./customer"

/*
 * Account form actions for the Tech Nest account pages. They validate with the
 * same rules as the browser, call Medusa through the SDK, and never log or
 * echo passwords, tokens or other personal data.
 */

async function revalidateCustomer() {
  const tag = await getCacheTag("customers")
  if (tag) revalidateTag(tag)
}

export async function loginAction(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, LOGIN_FIELDS)
  const errors = validateLogin(values)
  if (hasErrors(errors)) return errorState(prev, withoutSecrets(values), errors)

  const clean = new FormData()
  clean.set("email", values.email)
  clean.set("password", String(formData.get("password") ?? ""))
  const result = await login(null, clean)
  if (result?.state === "verification_required") {
    return { status: "success", attempt: prev.attempt, errors: {}, values: {}, message: "verify" }
  }
  if (result?.state !== "success") {
    return errorState(prev, withoutSecrets(values), {}, loginErrorMessage(result?.state === "error" ? result.error : ""))
  }
  redirect(safeReturnTo(formData.get("next")))
}

export async function registerAction(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, REGISTER_FIELDS)
  const errors = validateRegister(values)
  if (hasErrors(errors)) return errorState(prev, withoutSecrets(values), errors)

  // signup() reads these names from the FormData; pass trimmed values
  const clean = new FormData()
  for (const [k, v] of Object.entries(values)) clean.set(k, k === "password" ? String(formData.get(k) ?? "") : v)
  const result = await signup(null, clean)
  if (result?.state === "verification_required") {
    return { status: "success", attempt: prev.attempt, errors: {}, values: {}, message: "verify" }
  }
  if (result?.state !== "success") {
    return errorState(prev, withoutSecrets(values), {}, registerErrorMessage(result?.state === "error" ? result.error : ""))
  }
  redirect(safeReturnTo(formData.get("next")))
}

/**
 * Always answers the same way, whether or not an account exists, so the form
 * cannot be used to find out who shops here. E2's subscriber emails the link
 * (/account/reset-password?token=...&email=..., docs/contracts/emails.md).
 */
export async function forgotPasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, FORGOT_FIELDS)
  const errors = validateForgot(values)
  if (hasErrors(errors)) return errorState(prev, values, errors)

  try {
    await sdk.auth.resetPassword("customer", "emailpass", { identifier: values.email.toLowerCase() })
  } catch {
    // Unknown email and backend errors look the same to the visitor (see above)
  }
  return { status: "success", attempt: prev.attempt, errors: {}, values: { email: values.email } }
}

export async function resetPasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, RESET_FIELDS)
  const errors = validateReset(values)
  if (hasErrors(errors)) return errorState(prev, {}, errors)

  const token = String(formData.get("token") ?? "")
  if (!token) {
    return errorState(prev, {}, {}, "This reset link is not complete. Ask for a new link below.")
  }
  try {
    await sdk.auth.updateProvider("customer", "emailpass", { password: String(formData.get("password")) }, token)
  } catch {
    return errorState(
      prev,
      {},
      {},
      "This reset link has expired or has already been used. Ask for a new link below."
    )
  }
  redirect("/account/login?reset=1")
}

export async function updateProfileAction(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, PROFILE_FIELDS)
  const errors = validateProfile(values)
  if (hasErrors(errors)) return errorState(prev, values, errors)

  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) redirect("/account/login?next=/account/profile")
  try {
    await sdk.store.customer.update(
      { first_name: values.first_name, last_name: values.last_name, phone: values.phone || null } as HttpTypes.StoreUpdateCustomer,
      {},
      headers
    )
  } catch {
    return errorState(prev, values, {}, "Sorry, we could not save your details. Please try again.")
  }
  await revalidateCustomer()
  return { status: "success", attempt: prev.attempt, errors: {}, values, message: "Your details have been saved." }
}

export async function saveAddressAction(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, ADDRESS_FIELDS)
  const errors = validateAddress(values)
  if (hasErrors(errors)) return errorState(prev, values, errors)

  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) redirect("/account/login?next=/account/addresses")

  const id = String(formData.get("address_id") ?? "")
  const body = {
    first_name: values.first_name,
    last_name: values.last_name,
    company: values.company || null,
    address_1: values.address_1,
    address_2: values.address_2 || null,
    city: values.city,
    postal_code: formatUkPostcode(values.postal_code),
    phone: values.phone || null,
    country_code: "gb",
    is_default_shipping: values.is_default_shipping === "yes",
  }
  try {
    if (id) {
      await sdk.store.customer.updateAddress(id, body as HttpTypes.StoreUpdateCustomerAddress, {}, headers)
    } else {
      await sdk.store.customer.createAddress(body as HttpTypes.StoreCreateCustomerAddress, {}, headers)
    }
  } catch {
    return errorState(prev, values, {}, "Sorry, we could not save this address. Please try again.")
  }
  await revalidateCustomer()
  redirect(`/account/addresses?saved=${id ? "updated" : "added"}`)
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const id = String(formData.get("address_id") ?? "")
  const headers = await getAuthHeaders()
  if (!id || !("authorization" in headers)) redirect("/account/addresses")
  let ok = true
  try {
    await sdk.store.customer.deleteAddress(id, headers)
  } catch {
    ok = false
  }
  await revalidateCustomer()
  redirect(`/account/addresses?saved=${ok ? "removed" : "remove-failed"}`)
}
