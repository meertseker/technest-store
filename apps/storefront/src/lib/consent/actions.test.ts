import { beforeEach, describe, expect, it, vi } from "vitest"

const set = vi.fn()
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }))

import { saveConsent } from "./actions"

const form = (choice?: string) => {
  const f = new FormData()
  if (choice !== undefined) f.set("choice", choice)
  return f
}

describe("saveConsent", () => {
  beforeEach(() => set.mockReset())

  it.each(["accepted", "rejected"])("stores %s", async (choice) => {
    await saveConsent(form(choice))
    expect(set).toHaveBeenCalledWith("tn_consent", choice, expect.objectContaining({ path: "/" }))
  })

  it.each([undefined, "", "maybe", "accepted; Path=/x"])("ignores %j", async (choice) => {
    await saveConsent(form(choice))
    expect(set).not.toHaveBeenCalled()
  })
})
