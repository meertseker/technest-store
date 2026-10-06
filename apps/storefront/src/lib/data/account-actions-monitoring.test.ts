import { beforeEach, describe, expect, it, vi } from "vitest"

const customerUpdate = vi.fn()
const createAddress = vi.fn()
const updateAddress = vi.fn()
const deleteAddress = vi.fn()
const resetPassword = vi.fn()
const tradeFetch = vi.fn()
const removeAuthToken = vi.fn()
const captureException = vi.fn()
const redirect = vi.fn((to: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { to })
})

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }))
vi.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: (...a: unknown[]) => tradeFetch(...a) },
    auth: { resetPassword: (...a: unknown[]) => resetPassword(...a), updateProvider: vi.fn() },
    store: {
      customer: {
        update: (...a: unknown[]) => customerUpdate(...a),
        createAddress: (...a: unknown[]) => createAddress(...a),
        updateAddress: (...a: unknown[]) => updateAddress(...a),
        deleteAddress: (...a: unknown[]) => deleteAddress(...a),
      },
    },
  },
}))
vi.mock("./cookies", () => ({
  getAuthHeaders: async () => ({ authorization: "Bearer token" }),
  getCacheTag: async () => "customers-visitor",
  removeAuthToken: (...a: unknown[]) => removeAuthToken(...a),
}))
vi.mock("./customer", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  signout: vi.fn(),
  transferCart: vi.fn(),
  confirmEmailVerification: vi.fn(),
}))
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }))
/** What reaches monitoring: where each reported error was handled */
const reportedFrom = () => captureException.mock.calls.map(([, hint]) => hint?.tags?.handled_in)

import { initialFormState } from "@/lib/forms/state"
import {
  deleteAddressAction,
  forgotPasswordAction,
  saveAddressAction,
  updateProfileAction,
} from "./account-actions"

const httpError = (status: number, message = `HTTP ${status}`) => Object.assign(new Error(message), { status })

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const profile = form({ first_name: "Sam", last_name: "Lee", phone: "" })
const address = form({
  first_name: "Sam",
  last_name: "Lee",
  address_1: "1 High Street",
  city: "London",
  postal_code: "SE16 3TU",
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SENTRY_DSN", "https://key@example.invalid/1")
})

describe("failures the visitor only sees as a friendly message still reach monitoring", () => {
  it("a backend error while saving the profile is reported", async () => {
    const error = httpError(503)
    customerUpdate.mockRejectedValue(error)
    await updateProfileAction(initialFormState, profile)
    expect(captureException).toHaveBeenCalledWith(error, { tags: { handled_in: "account.update-profile" } })
  })

  it("a backend error while saving or removing an address is reported", async () => {
    createAddress.mockRejectedValue(httpError(500))
    await saveAddressAction(initialFormState, address)
    expect(reportedFrom()).toEqual(["account.save-address"])

    deleteAddress.mockRejectedValue(new TypeError("fetch failed"))
    await deleteAddressAction(form({ address_id: "addr_1" })).catch(() => {})
    expect(reportedFrom()).toEqual(["account.save-address", "account.delete-address"])
  })

  it("a backend error behind 'forgot password' is reported, and the visitor still gets the same answer", async () => {
    resetPassword.mockRejectedValue(httpError(500))
    const state = await forgotPasswordAction(initialFormState, form({ email: "sam@example.com" }))
    expect(state.status).toBe("success")
    expect(reportedFrom()).toEqual(["account.forgot-password"])
  })

  it("a refusal the visitor can act on is not reported", async () => {
    customerUpdate.mockRejectedValue(httpError(400, "Invalid phone"))
    await updateProfileAction(initialFormState, profile)
    resetPassword.mockRejectedValue(httpError(404))
    await forgotPasswordAction(initialFormState, form({ email: "nobody@example.com" }))
    expect(captureException).not.toHaveBeenCalled()
  })
})
