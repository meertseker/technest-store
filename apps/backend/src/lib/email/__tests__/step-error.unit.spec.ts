import { setAlertSinkForTests, type Alert } from "../../alerting"
import { isPermanentSmtpFailure } from "../safe-error"
import { sendEmailStepError } from "../step-error"

const smtp = (detail: string) =>
  new Error(`Failed to send notification with id noti_1:\nsmtp: send failed template=order-confirmation ${detail}`)

describe("isPermanentSmtpFailure", () => {
  it.each([
    ["a wrong login", "code=EAUTH response_code=535 command=AUTH PLAIN"],
    ["a rejected recipient", "code=EENVELOPE response_code=550 command=RCPT TO"],
    ["a rejected sender", "code=EENVELOPE response_code=553 command=MAIL FROM"],
    ["a message the server refuses for good", "code=EMESSAGE response_code=554 command=DATA"],
  ])("is true for %s", (_what, detail) => {
    expect(isPermanentSmtpFailure(smtp(detail))).toBe(true)
  })

  it.each([
    ["a refused connection", "code=ECONNECTION response_code=- command=CONN"],
    ["a timeout", "code=ETIMEDOUT response_code=- command=CONN"],
    ["a greylisting 4xx", "code=EENVELOPE response_code=451 command=RCPT TO"],
    ["a busy server", "code=EMESSAGE response_code=421 command=DATA"],
    ["an unknown failure", "code=unknown response_code=- command=-"],
  ])("is false for %s (worth another try)", (_what, detail) => {
    expect(isPermanentSmtpFailure(smtp(detail))).toBe(false)
  })

  it("is false for anything that is not a failed send", () => {
    expect(isPermanentSmtpFailure(new Error("Order order_1 was not found"))).toBe(false)
    expect(isPermanentSmtpFailure(new Error("code=EAUTH"))).toBe(false)
    expect(isPermanentSmtpFailure(undefined)).toBe(false)
  })
})

describe("sendEmailStepError", () => {
  const input = { template: "order-confirmation", resource_type: "order", resource_id: "order_1" }
  let alerts: Alert[]
  beforeEach(() => {
    alerts = []
    setAlertSinkForTests((a) => alerts.push(a))
  })
  afterEach(() => setAlertSinkForTests(undefined))

  it("turns a permanent failure into one the workflow engine does not retry, keeping the send-failed marker", () => {
    const original = smtp("code=EAUTH response_code=535 command=AUTH PLAIN")
    const e = sendEmailStepError(original, input) as Error
    expect(e).not.toBe(original)
    expect(e.name).toBe("PermanentStepFailure")
    expect(e.message).toContain("smtp: send failed")
    expect(e.message).toContain("code=EAUTH")
    expect(alerts).toEqual([])
  })

  it("rethrows a temporary failure as it is, so the step retries", () => {
    const original = smtp("code=ECONNECTION response_code=- command=CONN")
    expect(sendEmailStepError(original, input)).toBe(original)
    expect(alerts).toEqual([])
  })

  it("reports anything that is not a failed send (nothing is stored for the sweeper to find)", () => {
    const original = new Error("Order order_1 was not found")
    expect(sendEmailStepError(original, input)).toBe(original)
    expect(alerts).toEqual([
      {
        error: original,
        tags: { source: "workflow:send-email", template: "order-confirmation", resource_type: "order", resource_id: "order_1" },
      },
    ])
  })
})
