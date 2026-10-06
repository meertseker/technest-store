import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { deliverEmail } from "../deliver"

function fakeContainer(customer: Record<string, unknown> | undefined) {
  const created: any[] = []
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph: async () => ({ data: customer ? [customer] : [] }) },
    [Modules.NOTIFICATION]: {
      listNotifications: async () => [],
      createNotifications: async (rows: any[]) => {
        created.push(...rows)
        return rows.map((r, i) => ({ id: `noti_${i}`, ...r }))
      },
    },
    [Modules.LOCKING]: { execute: async (_key: string, job: () => Promise<unknown>) => job() },
  }
  return { created, container: { resolve: (key: string) => services[key] } as any }
}

const input = {
  template: "welcome",
  recipient: "customer" as const,
  resource_id: "cus_1",
  resource_type: "customer",
  trigger_type: "customer.created",
}

describe("deliverEmail", () => {
  it("sends the rendered email and stores only what is needed to send it again", async () => {
    const { container, created } = fakeContainer({ email: "sam@example.com", first_name: "Sam", has_account: true })

    expect(await deliverEmail(container, input)).toEqual({ id: "noti_0" })

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      to: "sam@example.com",
      channel: "email",
      template: "welcome",
      resource_id: "cus_1",
      resource_type: "customer",
      trigger_type: "customer.created",
    })
    expect(created[0].content.subject).toBe("Welcome to Tech Nest")
    expect(created[0].content.html).toContain("Hi Sam,")
    expect(created[0].content.text).toContain("Hi Sam,")
    // The stored row: who it was for (customer or shop), never the name, address or order.
    expect(created[0].data).toEqual({ recipient: "customer" })
  })

  it("keeps the extra ids an email is built from", async () => {
    const { container, created } = fakeContainer({ email: "sam@example.com", first_name: "Sam", has_account: true })
    await deliverEmail(container, { ...input, ids: ["a", "b"] })
    expect(created[0].data).toEqual({ recipient: "customer", ids: ["a", "b"] })
  })

  it("sends nothing when there is nobody to send to", async () => {
    const { container, created } = fakeContainer({ email: "g@example.com", has_account: false })
    expect(await deliverEmail(container, input)).toEqual({ skipped: true })
    expect(created).toEqual([])
  })
})
