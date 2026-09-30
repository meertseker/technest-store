import { resolveEmail } from "../sources"

function containerWithCustomer(customer: Record<string, unknown> | undefined) {
  const graph = jest.fn(async () => ({ data: customer ? [customer] : [] }))
  return {
    graph,
    container: { resolve: () => ({ graph }) } as any,
  }
}

describe("resolveEmail", () => {
  it("throws for a template without a source, so a typo never fails silently", async () => {
    const { container } = containerWithCustomer(undefined)
    await expect(resolveEmail(container, "no-such-template", "x", "customer")).rejects.toThrow(
      /no-such-template/
    )
  })

  it("welcomes registered customers with their first name, loaded by id", async () => {
    const { container, graph } = containerWithCustomer({
      email: "sam@example.com",
      first_name: "Sam",
      has_account: true,
    })
    const resolved = await resolveEmail(container, "welcome", "cus_1", "customer")
    expect(resolved).toEqual({ to: "sam@example.com", data: { first_name: "Sam" } })
    expect(graph).toHaveBeenCalledWith(expect.objectContaining({ filters: { id: "cus_1" } }))
  })

  it("sends nothing to guest customers or unknown ids", async () => {
    const guest = containerWithCustomer({ email: "g@example.com", first_name: "G", has_account: false })
    expect(await resolveEmail(guest.container, "welcome", "cus_2", "customer")).toBeNull()
    const missing = containerWithCustomer(undefined)
    expect(await resolveEmail(missing.container, "welcome", "cus_3", "customer")).toBeNull()
  })
})
