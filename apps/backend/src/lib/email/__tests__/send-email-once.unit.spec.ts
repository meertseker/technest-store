import { sendEmailOnce } from "../send-email-once"

type Row = {
  id: string
  to: string
  template: string
  resource_id: string
  status: string
  data?: Record<string, unknown>
}

function fakes(existing: Row[] = []) {
  const rows = [...existing]
  const created: any[] = []
  const lockKeys: string[] = []
  const notifications = {
    listNotifications: jest.fn(async (filter: any) =>
      rows.filter(
        (r) => r.to === filter.to && r.template === filter.template && r.resource_id === filter.resource_id
      )
    ),
    createNotifications: jest.fn(async (data: any[]) => {
      created.push(...data)
      return data.map((d, i) => ({ id: `noti_new_${i}`, ...d, status: "success" }))
    }),
  }
  const locking = {
    execute: jest.fn(async (key: string, job: () => Promise<unknown>) => {
      lockKeys.push(key)
      return job()
    }),
  }
  return { notifications, locking, created, lockKeys }
}

const input = {
  to: "sam@example.com",
  template: "order-confirmation",
  data: { display_id: 1 },
  resource_id: "order_1",
  resource_type: "order",
  trigger_type: "order.placed",
}

describe("sendEmailOnce", () => {
  it("sends when this email was never sent for this order", async () => {
    const f = fakes()
    const result = await sendEmailOnce(f as any, input)
    expect(result).toEqual({ id: "noti_new_0" })
    expect(f.created).toEqual([expect.objectContaining({ to: "sam@example.com", channel: "email" })])
    // No module idempotency key: its FAILURE-resend path is broken in 2.21.2.
    expect(f.created[0].idempotency_key).toBeUndefined()
  })

  it("skips when the same email already went out successfully", async () => {
    const f = fakes([{ id: "noti_1", to: input.to, template: input.template, resource_id: "order_1", status: "success" }])
    expect(await sendEmailOnce(f as any, input)).toEqual({ skipped: true, id: "noti_1" })
    expect(f.notifications.createNotifications).not.toHaveBeenCalled()
  })

  it("sends again when earlier attempts only failed", async () => {
    const f = fakes([{ id: "noti_1", to: input.to, template: input.template, resource_id: "order_1", status: "failure" }])
    expect(await sendEmailOnce(f as any, input)).toEqual({ id: "noti_new_0" })
  })

  it("treats a different recipient or template as a different email", async () => {
    const f = fakes([{ id: "noti_1", to: "shop@example.com", template: input.template, resource_id: "order_1", status: "success" }])
    expect(await sendEmailOnce(f as any, input)).toEqual({ id: "noti_new_0" })
  })

  it("a send key makes a separate email: sent although the plain one went out, then once per key", async () => {
    const sentPlain = { id: "noti_1", to: input.to, template: input.template, resource_id: "order_1", status: "success" }
    const f = fakes([sentPlain])
    const resend = { ...input, data: { recipient: "customer", send_key: "resend:1" }, send_key: "resend:1" }

    expect(await sendEmailOnce(f as any, resend)).toEqual({ id: "noti_new_0" })
    expect(f.lockKeys[0]).toMatch(/^email:order-confirmation:order_1:[0-9a-f]{16}:resend:1$/)

    const again = fakes([sentPlain, { ...sentPlain, id: "noti_2", data: { send_key: "resend:1" } }])
    expect(await sendEmailOnce(again as any, resend)).toEqual({ skipped: true, id: "noti_2" })
    expect(await sendEmailOnce(again as any, { ...resend, send_key: "resend:2" })).toEqual({ id: "noti_new_0" })
    // The plain email still sees only the plain send.
    expect(await sendEmailOnce(again as any, input)).toEqual({ skipped: true, id: "noti_1" })
  })

  it("checks and sends under one lock per email so concurrent duplicates can't both send", async () => {
    const f = fakes()
    await sendEmailOnce(f as any, input)
    expect(f.lockKeys).toHaveLength(1)
    expect(f.lockKeys[0]).toMatch(/^email:order-confirmation:order_1:[0-9a-f]{16}$/)
    // Lock errors ("Failed to acquire lock for key …") get logged: no address in the key.
    expect(f.lockKeys[0]).not.toContain("sam@example.com")
  })

  it("passes pre-rendered content through (kept out of the stored data)", async () => {
    const f = fakes()
    await sendEmailOnce(f as any, {
      ...input,
      template: "password-reset",
      data: {},
      content: { subject: "Reset", html: "<p>x</p>", text: "x" },
    })
    expect(f.created[0].content).toEqual({ subject: "Reset", html: "<p>x</p>", text: "x" })
    expect(f.created[0].data).toEqual({})
  })

  describe("key for the mail provider's own duplicate check", () => {
    const keyOf = async (over: Partial<typeof input> = {}) => {
      const f = fakes()
      await sendEmailOnce(f as any, { ...input, ...over })
      return f.created[0].provider_data.idempotency_key as string
    }

    it("is the same for every attempt at the same email", async () => {
      const key = await keyOf()
      expect(key).toMatch(/^email-[0-9a-f]{32}$/)
      expect(await keyOf()).toBe(key)
      expect(await keyOf({ to: "SAM@example.com" })).toBe(key)
    })

    it("differs by template, record and recipient, and does not contain the address", async () => {
      const keys = new Set([
        await keyOf(),
        await keyOf({ template: "shop-new-order" }),
        await keyOf({ resource_id: "order_2" }),
        await keyOf({ to: "kim@example.com" }),
      ])
      expect(keys.size).toBe(4)
      expect([...keys].join(" ")).not.toContain("sam")
    })
  })
})

