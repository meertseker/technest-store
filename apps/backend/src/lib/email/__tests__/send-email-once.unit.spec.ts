import { sendEmailOnce } from "../send-email-once"

type Row = { id: string; to: string; template: string; resource_id: string; status: string }

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

  it("checks and sends under one lock per email so concurrent duplicates can't both send", async () => {
    const f = fakes()
    await sendEmailOnce(f as any, input)
    expect(f.lockKeys).toEqual(["email:order-confirmation:order_1:sam@example.com"])
  })
})
