"use server"

import { sdk } from "@lib/config"
import { FetchError } from "@medusajs/js-sdk"
import { redirect } from "next/navigation"
import { errorState, type FormState } from "@/lib/forms/state"
import {
  TRADE_FIELDS,
  hasErrors,
  readForm,
  toTradeApplicationBody,
  validateTradeApplication,
} from "@/lib/forms/validation"
import { getAuthHeaders, removeAuthToken } from "./cookies"

/** POST /store/trade-applications for the signed-in customer (docs/contracts/trade.md) */
export async function submitTradeApplication(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, TRADE_FIELDS)
  const errors = validateTradeApplication(values)
  if (hasErrors(errors)) return errorState(prev, values, errors)

  const signIn = `/account/login?next=${encodeURIComponent("/trade/apply")}`
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) redirect(signIn)

  try {
    await sdk.client.fetch("/store/trade-applications", {
      method: "POST",
      body: toTradeApplicationBody(values),
      headers,
    })
  } catch (e) {
    const err = e as FetchError
    if (err?.status === 401) {
      // the backend no longer accepts the sign-in: stop looking signed in, then ask again
      await removeAuthToken()
      redirect(signIn)
    }
    // The contract's two business-rule errors are safe, plain messages
    if (err?.status === 400 && /already (have a pending|approved)/i.test(err.message)) {
      redirect("/account/trade")
    }
    if (err?.status === 400) {
      return errorState(prev, values, {}, "Some details were not accepted. Check your VAT and Companies House numbers and try again.")
    }
    return errorState(prev, values, {}, "Sorry, we could not send your application. Please try again, or call the shop.")
  }
  redirect("/account/trade?submitted=1")
}
