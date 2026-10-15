// Staff can resend the "ready for collection" email from the board: each press is a new email, a
// redelivered event is not, and only an order that is actually waiting for collection qualifies.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { collectLockKey } from "../../src/lib/click-collect"
import collectionEmails from "../../src/subscribers/collection-emails"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"
import { orderOf, placeAuthorisedOrder, shippingOptionIdsByCode } from "../helpers/orders"
import { mailTo, settle } from "../utils/mailpit"

const RUN = Date.now()
process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"

jest.setTimeout(10 * 60 * 1000)
jest.retryTimes(0)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: { headers: Record<string, string> }
    let regionId: string
    let options: Record<string, string>
    let seq = 0

    beforeAll(async () => {
      const container = getContainer()
      regionId = (await seedTechNest(container)).region.id
      options = await shippingOptionIdsByCode(container)
      admin = await adminHeaders(api, container)
      await waitForBackgroundWork(container)
    })
    afterEach(() => waitForBackgroundWork(getContainer()))

    async function pickupOrder() {
      const email = `e2-resend-${RUN}-${++seq}@example.com`
      const { order } = await placeAuthorisedOrder(getContainer(), {
        regionId,
        shippingOptionId: options["click-collect"],
        shippingAmount: 0,
        email,
      })
      return { id: order.id, display_id: order.display_id, email }
    }
    const post = (orderId: string, action: string) =>
      api.post(`/admin/click-collect/orders/${orderId}/${action}`, {}, admin).catch((e: any) => e.response)
    /** The "ready to collect" emails to this address, waiting (up to ~10 s) for at least `expected`. */
    const readyMails = async (email: string, expected: number) => {
      let found: { Subject: string }[] = []
      for (let i = 0; i < 40; i++) {
        found = (await mailTo(email, 0)).filter((m) => / is ready to collect$/.test(m.Subject))
        if (found.length >= expected) break
        await new Promise((r) => setTimeout(r, 250))
      }
      return found
    }

    it("each resend is a new email; a redelivered event sends nothing more", async () => {
      const o = await pickupOrder()
      expect((await post(o.id, "ready")).status).toBe(200)
      await waitForBackgroundWork(getContainer())
      expect(await readyMails(o.email, 1)).toHaveLength(1)

      const first = await post(o.id, "resend-ready")
      expect(first.status).toBe(200)
      expect(first.data.order.status).toBe("ready")
      await waitForBackgroundWork(getContainer())
      expect(await readyMails(o.email, 2)).toHaveLength(2)

      const meta = ((await orderOf(getContainer(), o.id)).metadata ?? {}) as Record<string, any>
      expect(meta.ready_email_resent_at).toEqual(expect.any(String))

      // The event bus delivers the same resend again: no third email.
      await collectionEmails({
        event: {
          name: "technest.order.ready_for_collection",
          data: { order_id: o.id, resend: true, send_key: `resend:${meta.ready_email_resent_at}` },
        },
        container: getContainer(),
      } as any)
      // And the original event again: still nothing.
      await collectionEmails({
        event: { name: "technest.order.ready_for_collection", data: { order_id: o.id } },
        container: getContainer(),
      } as any)
      await settle(o.email, 1500)
      expect(await readyMails(o.email, 3)).toHaveLength(2)

      // Pressed again within 10 minutes of the last resend: refused, nothing sent.
      const soon = await post(o.id, "resend-ready")
      expect(soon.status).toBe(429)
      expect(soon.data.type).toBe("too_many_requests")
      await settle(o.email, 1500)
      expect(await readyMails(o.email, 3)).toHaveLength(2)

      // Ten minutes on, it can be resent again.
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(o.id, { metadata: { ready_email_resent_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() } })
      expect((await post(o.id, "resend-ready")).status).toBe(200)
      await waitForBackgroundWork(getContainer())
      expect(await readyMails(o.email, 3)).toHaveLength(3)
    })

    it("is refused with 400 unless the order is ready, and sends nothing", async () => {
      const toPick = await pickupOrder()
      const res = await post(toPick.id, "resend-ready")
      expect(res.status).toBe(400)

      const collected = await pickupOrder()
      expect((await post(collected.id, "ready")).status).toBe(200)
      expect((await post(collected.id, "collected")).status).toBe(200)
      await waitForBackgroundWork(getContainer())
      expect((await post(collected.id, "resend-ready")).status).toBe(400)
      await settle(collected.email, 1500)
      expect(await readyMails(collected.email, 2)).toHaveLength(1)
      expect(await readyMails(toPick.email, 1)).toHaveLength(0)
    })

    it("returns 409 while another action holds the order's lock", async () => {
      const o = await pickupOrder()
      expect((await post(o.id, "ready")).status).toBe(200)
      const locking = getContainer().resolve(Modules.LOCKING)
      await locking.acquire(collectLockKey(o.id), { ownerId: "test-holder", expire: 60 })
      try {
        expect((await post(o.id, "resend-ready")).status).toBe(409)
      } finally {
        await locking.release(collectLockKey(o.id), { ownerId: "test-holder" })
      }
    })
  },
})
