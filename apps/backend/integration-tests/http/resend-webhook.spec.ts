import { createHmac, randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { setAlertSinkForTests, type Alert } from "../../src/lib/alerting"
import { mailTo } from "../utils/mailpit"
import { warmDb } from "../utils/warm-db"

const KEY = randomBytes(24)
const SECRET = `whsec_${KEY.toString("base64")}`
const URL = "/hooks/email/resend"
const RUN = Date.now()

jest.setTimeout(240 * 1000)

/** Headers Svix would send for this body (one new message id per call). */
function svixHeaders(body: string, over: { ts?: number; key?: Buffer } = {}) {
  const id = `msg_${Math.random().toString(36).slice(2)}`
  const ts = over.ts ?? Math.floor(Date.now() / 1000)
  const sig = createHmac("sha256", over.key ?? KEY).update(`${id}.${ts}.${body}`).digest("base64")
  return { "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` }
}

/** A Resend event as raw JSON, deliberately not in JSON.stringify's canonical form. */
const event = (type: string, to: string, extra = "") =>
  `{ "type": "${type}",\n  "created_at": "2026-10-10T09:00:00.000Z",\n  "data": { "email_id": "re_${RUN}", "from": "Tech Nest <orders@technestlondon.co.uk>", "to": ["${to}"], "subject": "Order confirmed: #1042"${extra} } }`

const bounce = `, "bounce": { "message": "mailbox unavailable", "type": "Permanent", "subType": "General" }`

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let alerts: Alert[]
    const original = process.env.RESEND_WEBHOOK_SECRET

    const post = (body: string, headers: Record<string, string>) =>
      api
        .post(URL, body, { headers: { "content-type": "application/json", ...headers } })
        .catch((e: any) => e.response)

    beforeEach(async () => {
      await warmDb(getContainer())
      alerts = []
      setAlertSinkForTests((a) => alerts.push(a))
      process.env.RESEND_WEBHOOK_SECRET = SECRET
    })
    afterEach(() => {
      setAlertSinkForTests(undefined)
      if (original === undefined) delete process.env.RESEND_WEBHOOK_SECRET
      else process.env.RESEND_WEBHOOK_SECRET = original
    })

    describe("POST /hooks/email/resend", () => {
      it("reports a bounce with the stored attempt's ids, never the address", async () => {
        const to = `e2-bounce-${RUN}@example.com`
        const [sent] = await (getContainer().resolve(Modules.NOTIFICATION) as any).createNotifications([
          {
            to,
            channel: "email",
            template: "order-confirmation",
            resource_id: "order_bounce_1",
            resource_type: "order",
            trigger_type: "order.placed",
            content: { subject: "Order confirmed: #1042", text: "ok" },
          },
        ])
        await mailTo(to, 1)
        const logger = getContainer().resolve("logger") as any
        const lines: string[] = []
        const spy = jest.spyOn(logger, "warn").mockImplementation((m: string) => void lines.push(m))

        const body = event("email.bounced", to, bounce)
        const res = await post(body, svixHeaders(body))

        spy.mockRestore()
        expect(res.status).toBe(200)
        expect(alerts).toHaveLength(1)
        expect(alerts[0].message).toMatch(/bounced/)
        expect(alerts[0].tags).toMatchObject({
          source: "webhook:resend",
          event: "email.bounced",
          bounce_type: "Permanent",
          notification_id: sent.id,
          template: "order-confirmation",
          resource_type: "order",
          resource_id: "order_bounce_1",
        })
        const everything = JSON.stringify(alerts) + lines.join("\n")
        expect(lines.join("\n")).toContain(sent.id)
        expect(everything).not.toContain(to)
        expect(everything).not.toContain("Order confirmed")
      })

      it("matches a late bounce to the email Resend says bounced, not a newer one to the same address", async () => {
        const to = `e2-late-${RUN}@example.com`
        const notifications = getContainer().resolve(Modules.NOTIFICATION) as any
        const attempt = (resource_id: string, template: string) => ({
          to,
          channel: "email",
          template,
          resource_id,
          resource_type: "order",
          trigger_type: "order.placed",
          content: { subject: "Your order", text: "ok" },
        })
        const [first] = await notifications.createNotifications([attempt("order_late_1", "order-confirmation")])
        await mailTo(to, 1)
        // The confirmation went out two hours ago, Resend accepted it a few seconds later.
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
        const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
        await pg("notification").where({ id: first.id }).update({ created_at: twoHoursAgo })
        const sentAt = new Date(twoHoursAgo.getTime() + 5000).toISOString()
        await notifications.createNotifications([attempt("order_late_2", "order-dispatched")])
        await mailTo(to, 2)

        const body = event("email.bounced", to, `${bounce}, "created_at": "${sentAt}"`)
        const res = await post(body, svixHeaders(body))
        expect(res.status).toBe(200)
        expect(alerts).toHaveLength(1)
        expect(alerts[0].tags).toMatchObject({ notification_id: first.id, resource_id: "order_late_1", match: "sent_time" })
      })

      it("matches the stored attempt when Resend reports the address in another case", async () => {
        const to = `e2-case-${RUN}@example.com`
        const [sent] = await (getContainer().resolve(Modules.NOTIFICATION) as any).createNotifications([
          {
            to,
            channel: "email",
            template: "order-confirmation",
            resource_id: "order_case_1",
            resource_type: "order",
            trigger_type: "order.placed",
            content: { subject: "Your order", text: "ok" },
          },
        ])
        await mailTo(to, 1)
        const body = event("email.bounced", to.toUpperCase(), bounce)
        const res = await post(body, svixHeaders(body))
        expect(res.status).toBe(200)
        expect(alerts[0].tags).toMatchObject({ notification_id: sent.id, match: "newest" })
      })

      it("reports a complaint even when no stored attempt matches", async () => {
        const body = event("email.complained", `nobody-${RUN}@example.com`)
        const res = await post(body, svixHeaders(body))
        expect(res.status).toBe(200)
        expect(alerts).toHaveLength(1)
        expect(alerts[0].tags).toMatchObject({ source: "webhook:resend", event: "email.complained" })
        expect(alerts[0].tags.notification_id).toBeUndefined()
        expect(JSON.stringify(alerts)).not.toContain(`nobody-${RUN}`)
      })

      it("acknowledges other events without reporting them", async () => {
        const body = event("email.delivered", `ok-${RUN}@example.com`)
        const res = await post(body, svixHeaders(body))
        expect(res.status).toBe(200)
        expect(alerts).toEqual([])
      })

      it.each([
        ["no signature headers", (b: string) => ({ body: b, headers: {} as Record<string, string> })],
        ["a signature for another secret", (b: string) => ({ body: b, headers: svixHeaders(b, { key: randomBytes(24) }) })],
        ["a tampered body", (b: string) => ({ body: b.replace("Permanent", "Transient"), headers: svixHeaders(b) })],
        [
          "a replay from ten minutes ago",
          (b: string) => ({ body: b, headers: svixHeaders(b, { ts: Math.floor(Date.now() / 1000) - 600 }) }),
        ],
      ])("answers 400 to %s and reports nothing", async (_name, make) => {
        const { body, headers } = make(event("email.bounced", `bad-${RUN}@example.com`, bounce))
        const res = await post(body, headers)
        expect(res.status).toBe(400)
        expect(alerts).toEqual([])
      })

      it("answers 503 while RESEND_WEBHOOK_SECRET is unset, even to a well-formed request", async () => {
        delete process.env.RESEND_WEBHOOK_SECRET
        const body = event("email.bounced", `unset-${RUN}@example.com`, bounce)
        const res = await post(body, svixHeaders(body))
        expect(res.status).toBe(503)
        expect(alerts).toEqual([])
      })
    })
  },
})
