import { resolveProductIds } from "../resolve-product-ids"

/**
 * A fake `query.graph` that answers like Medusa 2.21: product options are shared
 * across products (many-to-many), so an option row has `products`, not `product_id`.
 */
function contextWith(rows: Record<string, Record<string, any>[]>) {
  const graph = jest.fn(async ({ entity }: { entity: string }) => ({
    data: rows[entity] ?? [],
  }))
  return {
    graph,
    context: { container: { query: { graph } } } as any,
  }
}

describe("resolveProductIds", () => {
  it("maps a product-option event to every product that shares the option", async () => {
    const { graph, context } = contextWith({
      product_option: [
        { id: "opt_1", products: [{ id: "prod_a" }, { id: "prod_b" }] },
      ],
    })

    const ids = await resolveProductIds(
      { name: "product-option.created", data: { id: "opt_1" } },
      context
    )

    expect(ids.sort()).toEqual(["prod_a", "prod_b"])
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "product_option", fields: ["products.id"] })
    )
  })

  it("maps a product-option-value event through its option's products", async () => {
    const { context } = contextWith({
      product_option_value: [
        { id: "optval_1", option: { products: [{ id: "prod_a" }] } },
        { id: "optval_2", option: null },
      ],
    })

    const ids = await resolveProductIds(
      { name: "product-option-value.updated", data: [{ id: "optval_1" }, { id: "optval_2" }] },
      context
    )

    expect(ids).toEqual(["prod_a"])
  })

  it("never throws on rows without products (option created before it is attached)", async () => {
    const { context } = contextWith({
      product_option: [{ id: "opt_1" }, undefined as any],
    })

    await expect(
      resolveProductIds({ name: "product-option.created", data: { id: "opt_1" } }, context)
    ).resolves.toEqual([])
  })
})
