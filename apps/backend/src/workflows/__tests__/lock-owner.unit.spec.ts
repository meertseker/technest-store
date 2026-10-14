import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer, Modules } from "@medusajs/framework/utils"
import { recordPaymentNoticeWorkflow } from "../record-payment-notice"
import { newLockOwnerId } from "../steps/lock-owner"

type Call = { op: "acquire" | "release"; keys: unknown; ownerId?: string }

/** A container with just what record-payment-notice touches: the locking and order modules. */
function fakeContainer(opts: { failUpdate?: boolean } = {}) {
  const calls: Call[] = []
  const container = createMedusaContainer()
  container.register({
    [Modules.LOCKING]: asValue({
      acquire: async (keys: unknown, args: { ownerId?: string }) => {
        calls.push({ op: "acquire", keys, ownerId: args?.ownerId })
      },
      release: async (keys: unknown, args: { ownerId?: string }) => {
        calls.push({ op: "release", keys, ownerId: args?.ownerId })
        return true
      },
    }),
    [Modules.ORDER]: asValue({
      retrieveOrder: async (id: string) => ({ id, metadata: {} }),
      updateOrders: async () => {
        if (opts.failUpdate) throw new Error("update failed")
      },
    }),
  })
  return { container, calls }
}

describe("lock owner ids", () => {
  it("are unique per call and name the workflow", () => {
    const a = newLockOwnerId("mark-collected")
    const b = newLockOwnerId("mark-collected")
    expect(a).not.toBe(b)
    expect(a).toMatch(/^technest:mark-collected:[0-9a-f-]{36}$/)
  })

  it("each run takes and releases its order lock as its own owner", async () => {
    const { container, calls } = fakeContainer()
    const input = { order_id: "order_1", patch: { note: "x" } }

    await recordPaymentNoticeWorkflow(container).run({ input })
    await recordPaymentNoticeWorkflow(container).run({ input })

    expect(calls.map((c) => c.op)).toEqual(["acquire", "release", "acquire", "release"])
    const owners = calls.map((c) => c.ownerId)
    owners.forEach((o) => expect(o).toMatch(/^technest:record-payment-notice:/))
    // A run releases with the id it acquired with, and the two runs differ.
    expect(owners[0]).toBe(owners[1])
    expect(owners[2]).toBe(owners[3])
    expect(owners[0]).not.toBe(owners[2])
  })

  it("a failed run gives the lock back as the same owner", async () => {
    const { container, calls } = fakeContainer({ failUpdate: true })

    const { errors } = await recordPaymentNoticeWorkflow(container).run({
      input: { order_id: "order_1", patch: { note: "x" } },
      throwOnError: false,
    })

    expect(errors.map((e) => (e.error as Error)?.message)).toEqual(["update failed"])
    expect(calls.map((c) => c.op)).toEqual(["acquire", "release"])
    expect(calls[1].ownerId).toBe(calls[0].ownerId)
    expect(calls[0].ownerId).toMatch(/^technest:record-payment-notice:/)
  })
})
