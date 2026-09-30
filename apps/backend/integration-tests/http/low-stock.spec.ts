import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createReservationsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { seedTechNest } from "../../src/scripts/seed"
import { PRODUCTS } from "../../src/scripts/seed/data"
import { runLowStockCheck } from "../../src/jobs/low-stock-digest"
import { LOW_STOCK_EVENT, LowStockEventData } from "../../src/lib/low-stock"

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    const received: LowStockEventData[] = []
    let locationId: string
    const variantsByHandle: Record<string, { id: string; inventory_item_id: string }[]> = {}

    const waitForEvents = async (n: number) => {
      const deadline = Date.now() + 30_000
      while (received.length < n && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    beforeAll(async () => {
      const container = getContainer()
      const { stockLocation } = await seedTechNest(container)
      locationId = stockLocation.id

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "product.handle", "inventory_items.inventory_item_id"],
      })
      for (const v of variants) {
        const handle = v.product!.handle as string
        ;(variantsByHandle[handle] ??= []).push({
          id: v.id,
          inventory_item_id: v.inventory_items![0]!.inventory_item_id as string,
        })
      }

      const eventBus = container.resolve(Modules.EVENT_BUS)
      eventBus.subscribe(LOW_STOCK_EVENT, async (event: { data: LowStockEventData }) => {
        received.push(event.data)
      })
    })

    beforeEach(() => {
      received.length = 0
    })

    it("emits one event listing every variant at or below its reorder level", async () => {
      const items = await runLowStockCheck(getContainer())
      await waitForEvents(1)

      const lowHandles = PRODUCTS.filter((p) => p.stock <= p.reorder_level).map((p) => p.handle)
      expect(lowHandles.length).toBeGreaterThan(0)
      const expectedIds = lowHandles.flatMap((h) => variantsByHandle[h].map((v) => v.id))

      expect(received).toHaveLength(1)
      expect(received[0].items).toEqual(items)
      expect(items.map((i) => i.variant_id).sort()).toEqual(expectedIds.sort())

      const lens = PRODUCTS.find((p) => p.handle === "camera-lens-protector")!
      const lensItem = items.find((i) => i.variant_id === variantsByHandle[lens.handle][0].id)!
      expect(lensItem).toEqual({
        variant_id: expect.stringMatching(/^variant_/),
        sku: expect.stringMatching(/^CAMERA-LENS-PROTECTOR/),
        title: expect.stringMatching(/^Camera Lens Protector \(/),
        stocked_quantity: lens.stock,
        threshold: lens.reorder_level,
      })
      // Emptiest first.
      const stocks = items.map((i) => i.stocked_quantity)
      expect(stocks).toEqual([...stocks].sort((a, b) => a - b))
    })

    it("counts reserved stock (e.g. Click & Collect orders) as gone", async () => {
      // Leather Wallet Case: 8 in stock, reorder level 3. Reserve 5 of one variant.
      const [variant] = variantsByHandle["leather-wallet-case"]
      await createReservationsWorkflow(getContainer()).run({
        input: {
          reservations: [
            {
              inventory_item_id: variant.inventory_item_id,
              location_id: locationId,
              quantity: 5,
            },
          ],
        },
      })
      const items = await runLowStockCheck(getContainer())
      expect(items.find((i) => i.variant_id === variant.id)).toMatchObject({
        stocked_quantity: 8,
        threshold: 3,
      })
    })

    it("emits nothing when no variant is low", async () => {
      const container = getContainer()
      await updateInventoryLevelsWorkflow(container).run({
        input: {
          updates: Object.values(variantsByHandle)
            .flat()
            .map((v) => ({
              inventory_item_id: v.inventory_item_id,
              location_id: locationId,
              stocked_quantity: 1000,
            })),
        },
      })
      const items = await runLowStockCheck(container)
      expect(items).toEqual([])
      await new Promise((r) => setTimeout(r, 1000))
      expect(received).toHaveLength(0)
    })
  },
})
