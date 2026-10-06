import "server-only"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { FetchError } from "@medusajs/js-sdk"
import { reportUnexpected } from "@lib/monitoring/report"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { cache } from "react"
import {
  getAuthHeaders,
  getCacheTag,
  getCartId,
  getPendingCustomer,
  removeAuthToken,
  removeCartId,
  removePendingCustomer,
  setAuthToken,
  setPendingCustomer,
} from "./cookies"

export type CustomerAuthState =
  | { state: "error"; error: string }
  | { state: "verification_required"; email: string }
  | { state: "success" }
  | null

// Requests a verification email for the given customer. The request must be
// authenticated with a token tied to the auth identity (the token returned by
// register or by a login that requires verification).
async function requestVerificationEmail(email: string, token: string) {
  await sdk.auth.verification.request(
    {
      entity_id: email,
      entity_type: "email",
    },
    {
      authorization: `Bearer ${token}`,
    }
  )
}

// One backend read per page render (the layout, the account layout and the page
// all ask for the customer); outside a render every call reads again.
const readCustomer = cache(async (): Promise<HttpTypes.StoreCustomer | null> => {
  const headers = await getAuthHeaders()

  // a guest: nothing to ask the backend
  if (!("authorization" in headers)) return null

  return await sdk.client
    .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
      method: "GET",
      query: {
        fields: "*orders",
      },
      headers,
      // personal data: read fresh, never stored
      cache: "no-store",
    })
    .then(({ customer }) => customer)
    .catch(async (error) => {
      // 401 = not signed in any more. Anything else is a backend problem: the
      // page still treats the visitor as signed out, but we need to know.
      await reportUnexpected(error, "customer.read")
      return null
    })
})

export const retrieveCustomer = async (): Promise<HttpTypes.StoreCustomer | null> => readCustomer()

export type SignupInput = {
  email: string
  password: string
  first_name: string
  last_name: string
  phone: string
}

/** Registers and signs in. Callers (the form actions) validate the input first. */
export async function signup({ password, ...fields }: SignupInput): Promise<CustomerAuthState> {
  // One spelling everywhere: the password-reset lookup is lower case, so an
  // account registered as "Sam@..." would never get its reset email.
  const customerForm = { ...fields, email: normaliseEmail(fields.email) }

  try {
    await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password,
    })
  } catch (error) {
    const fetchError = error as FetchError
    // An existing identity (for example, an admin user with the same email) is
    // expected and handled: the customer can still log in to link a customer
    // record. Any other error is surfaced.
    if (
      fetchError.statusText !== "Unauthorized" ||
      fetchError.message !== "Identity with email already exists"
    ) {
      await reportUnexpected(error, "account.register")
      return { state: "error", error: String(error) }
    }
  }

  // Persist the extra signup fields. The customer record is created during
  // login, which is deferred until after email verification when the backend
  // requires it.
  await setPendingCustomer(customerForm)

  // Continue by logging in. The login response tells us whether the backend
  // requires email verification — we don't need a storefront-side flag.
  return completeLogin(customerForm.email, password)
}

/** Signs in. Callers (the form actions) validate the input first. */
export async function login(email: string, password: string): Promise<CustomerAuthState> {
  const typed = email.trim()
  const lower = normaliseEmail(email)
  const result = await completeLogin(lower, password)
  // An account made before emails were lower-cased is stored as it was typed.
  if (result?.state === "error" && typed !== lower) return completeLogin(typed, password)
  return result
}

const normaliseEmail = (email: string) => email.trim().toLowerCase()

// Logs the customer in and reconciles the customer record. The behavior is
// driven entirely by the backend's login response, so it works whether or not
// email verification is enabled.
async function completeLogin(
  email: string,
  password: string
): Promise<CustomerAuthState> {
  let result: Awaited<ReturnType<typeof sdk.auth.login>>

  try {
    result = await sdk.auth.login("customer", "emailpass", { email, password })
  } catch (error) {
    await reportUnexpected(error, "account.login")
    return { state: "error", error: String(error) }
  }

  // A `location` is returned by third-party auth providers, which this flow
  // doesn't support.
  if (typeof result === "object" && "location" in result) {
    return {
      state: "error",
      error: "This login method isn't supported by the storefront.",
    }
  }

  // The backend requires email verification and the customer hasn't verified
  // yet. Send the verification email and ask them to check their inbox.
  if (
    typeof result === "object" &&
    "verification_required" in result &&
    result.verification_required
  ) {
    try {
      await requestVerificationEmail(email, result.token)
    } catch {
      // Ignore: the customer can resend from the verification page.
    }
    return { state: "verification_required", email }
  }

  if (typeof result !== "string") {
    return {
      state: "error",
      error: "Authentication requires additional steps that aren't supported.",
    }
  }

  let token = result

  // The token may not be tied to a customer record yet — right after
  // registration, or after verifying a brand-new account. Ask the backend:
  // `/store/customers/me` rejects tokens without a registered actor, so a
  // failed retrieve means we still need to create the customer, then log in
  // again to obtain a customer-bound token.
  const customerExists = await sdk.store.customer
    .retrieve({}, { authorization: `Bearer ${token}` })
    .then(() => true)
    .catch(() => false)

  if (!customerExists) {
    const pending = await getPendingCustomer()

    try {
      await sdk.store.customer.create(
        {
          email,
          first_name: pending?.first_name,
          last_name: pending?.last_name,
          phone: pending?.phone,
        },
        {},
        { authorization: `Bearer ${token}` }
      )

      token = (await sdk.auth.login("customer", "emailpass", {
        email,
        password,
      })) as string
    } catch (error) {
      await reportUnexpected(error, "account.create-customer")
      return { state: "error", error: String(error) }
    }

    await removePendingCustomer()
  }

  await setAuthToken(token)

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  try {
    await transferCart()
  } catch (error) {
    await reportUnexpected(error, "account.transfer-basket")
    return { state: "error", error: String(error) }
  }

  return { state: "success" }
}

// Confirms a customer's email using the token from the verification link.
//
// The confirm route doesn't require authentication, so this works even when the
// customer opens the link on a different device than the one they signed up on.
export async function confirmEmailVerification(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await sdk.auth.verification.confirm({ code: token })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function signout() {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect("/account")
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}
