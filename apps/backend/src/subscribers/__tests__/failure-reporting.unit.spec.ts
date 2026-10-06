const captureRun = jest.fn()
jest.mock("../../workflows/capture-delivery-order", () => ({
  captureDeliveryOrderWorkflow: () => ({ run: captureRun }),
}))
const emailRun = jest.fn()
jest.mock("../../workflows/send-email", () => ({
  sendEmailWorkflow: () => ({ run: emailRun }),
}))

import { setAlertSinkForTests, type Alert } from "../../lib/alerting"
import { runEmail } from "../../lib/email/run-email"
import orderPlacedCapture from "../order-placed-capture"
import orderPlacedEmails from "../order-placed-emails"
import refundIssuedEmail from "../refund-issued-email"

const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
const container = { resolve: () => logger } as any
const placed = { event: { name: "order.placed", data: { id: "order_1" } }, container } as any

describe("background failures reach a person, not only the log", () => {
  let alerts: Alert[]
  beforeEach(() => {
    alerts = []
    setAlertSinkForTests((a) => alerts.push(a))
    captureRun.mockReset()
    emailRun.mockReset()
  })
  afterEach(() => setAlertSinkForTests(undefined))

  describe("order.placed capture", () => {
    it("reports a failed capture once, with the order id, and does not throw", async () => {
      const error = new Error("Your card was declined")
      captureRun.mockRejectedValue(error)
      await expect(orderPlacedCapture(placed)).resolves.toBeUndefined()
      expect(alerts).toEqual([{ error, tags: { source: "subscriber:order-placed-capture", order_id: "order_1" } }])
    })

    it("does not report a held lock: it is thrown to be retried", async () => {
      const busy = new Error("Failed to acquire lock for key order_1")
      captureRun.mockRejectedValue(busy)
      await expect(orderPlacedCapture(placed)).rejects.toBe(busy)
      expect(alerts).toEqual([])
    })

    it("reports nothing when the capture works", async () => {
      captureRun.mockResolvedValue({ result: { captured_payment_ids: ["pay_1"] } })
      await orderPlacedCapture(placed)
      expect(alerts).toEqual([])
    })
  })

  describe("emails", () => {
    const input = {
      template: "order-confirmation",
      recipient: "customer" as const,
      resource_id: "order_1",
      resource_type: "order",
      trigger_type: "order.placed",
    }

    it("reports an email that could not even be attempted", async () => {
      const error = new Error("Order order_1 not found")
      emailRun.mockRejectedValue(error)
      await expect(runEmail(container, input)).resolves.toBeUndefined()
      expect(alerts).toEqual([
        {
          error,
          tags: { source: "email:order.placed", template: "order-confirmation", resource_type: "order", resource_id: "order_1" },
        },
      ])
    })

    it("leaves a failed send to the sweeper, which retries it and raises its own alert", async () => {
      emailRun.mockRejectedValue(new Error("Failed to send notification with id noti_1:\nsmtp: send failed template=order-confirmation code=ECONNECTION"))
      await runEmail(container, input)
      expect(alerts).toEqual([])
    })

    it("order.placed still alerts the shop when the customer's confirmation fails", async () => {
      emailRun.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({})
      await expect(orderPlacedEmails(placed)).resolves.toBeUndefined()
      expect(emailRun.mock.calls.map((c) => c[0].input.template)).toEqual(["order-confirmation", "shop-new-order"])
      expect(alerts).toHaveLength(1)
    })

    it("reports a subscriber that fails before it gets to the email", async () => {
      const error = new Error("connection terminated")
      const broken = {
        resolve: () => ({
          graph: async () => {
            throw error
          },
        }),
      } as any
      await expect(
        refundIssuedEmail({ event: { name: "payment.refunded", data: { id: "pay_1" } }, container: broken } as any)
      ).rejects.toBe(error)
      expect(alerts).toEqual([{ error, tags: { source: "subscriber:refund-issued-email", event: "payment.refunded" } }])
    })
  })
})
