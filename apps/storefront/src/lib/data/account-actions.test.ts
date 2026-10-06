import { beforeEach, describe, expect, it, vi } from "vitest"

const customerUpdate = vi.fn()
const createAddress = vi.fn()
const updateAddress = vi.fn()
const deleteAddress = vi.fn()
const resetPassword = vi.fn()
const tradeFetch = vi.fn()
const removeAuthToken = vi.fn()
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

import { initialFormState } from "@/lib/forms/state"
import {
  deleteAddressAction,
  saveAddressAction,
  updateProfileAction,
} from "./account-actions"
import { submitTradeApplication } from "./trade-actions"

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
})

describe("a sign-in the backend no longer accepts", () => {
  it("saving the profile signs the visitor out and sends them to sign in, back to the profile", async () => {
    customerUpdate.mockRejectedValue(httpError(401, "Unauthorized"))
    await expect(updateProfileAction(initialFormState, profile)).rejects.toMatchObject({
      to: "/account/login?next=%2Faccount%2Fprofile",
    })
    expect(removeAuthToken).toHaveBeenCalled()
  })

  it("saving an address does the same", async () => {
    createAddress.mockRejectedValue(httpError(401, "Unauthorized"))
    await expect(saveAddressAction(initialFormState, address)).rejects.toMatchObject({
      to: "/account/login?next=%2Faccount%2Faddresses",
    })
    expect(removeAuthToken).toHaveBeenCalled()
  })

  it("removing an address does the same", async () => {
    deleteAddress.mockRejectedValue(httpError(401, "Unauthorized"))
    await expect(deleteAddressAction(form({ address_id: "addr_1" }))).rejects.toMatchObject({
      to: "/account/login?next=%2Faccount%2Faddresses",
    })
    expect(removeAuthToken).toHaveBeenCalled()
  })

  it("a trade application does the same", async () => {
    tradeFetch.mockRejectedValue(httpError(401, "Unauthorized"))
    const trade = form({
      company_name: "Lee Phones Ltd",
      business_type: "limited_company",
      vat_number: "",
      companies_house_number: "12345678",
      contact_name: "Sam Lee",
      contact_phone: "07700 900982",
      contact_email: "sam@example.com",
    })
    await expect(submitTradeApplication(initialFormState, trade)).rejects.toMatchObject({
      to: "/account/login?next=%2Ftrade%2Fapply",
    })
    expect(removeAuthToken).toHaveBeenCalled()
  })

  it("an ordinary failure keeps the visitor signed in and shows the friendly message", async () => {
    customerUpdate.mockRejectedValue(httpError(500))
    const state = await updateProfileAction(initialFormState, profile)
    expect(state.formError).toBe("Sorry, we could not save your details. Please try again.")
    expect(removeAuthToken).not.toHaveBeenCalled()
  })
})
