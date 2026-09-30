"use server"

import { sdk } from "@lib/config"
import { FetchError } from "@medusajs/js-sdk"
import { headers as nextHeaders } from "next/headers"
import { errorState, type FormState } from "@/lib/forms/state"
import {
  REPAIR_FIELDS,
  hasErrors,
  readForm,
  toRepairBookingBody,
  validateRepairBooking,
} from "@/lib/forms/validation"

/**
 * The visitor's IP for the backend's rate limit and Turnstile `remoteip`.
 * The storefront server calls the backend, so without this every visitor
 * would share one limit (5 bookings per 10 minutes, docs/contracts/repairs.md).
 * In production Caddy sets CF-Connecting-IP on the request to the storefront.
 */
async function clientIpHeader(): Promise<Record<string, string>> {
  try {
    const h = await nextHeaders()
    const ip = h.get("cf-connecting-ip")?.trim()
    return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? { "cf-connecting-ip": ip } : {}
  } catch {
    return {}
  }
}

/** POST /store/repair-bookings (no login needed) */
export async function submitRepairBooking(prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData, REPAIR_FIELDS)
  const errors = validateRepairBooking(values)
  const token = String(formData.get("cf-turnstile-response") ?? "").trim()
  if (hasErrors(errors)) return errorState(prev, values, errors)
  if (!token) {
    return errorState(prev, values, { security_check: "Wait for the security check to finish, then send the form again" })
  }

  try {
    await sdk.client.fetch<{ repair_booking: { id: string; status: string } }>(
      "/store/repair-bookings",
      { method: "POST", body: toRepairBookingBody(values, token), headers: await clientIpHeader() }
    )
    return {
      status: "success",
      attempt: prev.attempt,
      errors: {},
      // Only what the success panel needs; nothing is stored client-side
      values: { name: values.name.split(" ")[0] ?? "", phone: values.phone },
    }
  } catch (e) {
    const err = e as FetchError
    if (err?.status === 429) {
      return errorState(prev, values, {}, "You have sent several requests in a short time. Please wait 10 minutes and try again, or call the shop.")
    }
    if (err?.status === 400 && /turnstile/i.test(err.message)) {
      return errorState(prev, values, { security_check: "The security check did not work. Try it again, then send the form" })
    }
    if (err?.status === 400) {
      return errorState(prev, values, {}, "Some details were not accepted. Check the form and try again, or call the shop.")
    }
    return errorState(prev, values, {}, "Sorry, we could not send your request. Please try again, or call the shop.")
  }
}
