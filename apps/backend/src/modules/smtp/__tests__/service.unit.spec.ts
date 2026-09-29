import SmtpNotificationService from "../service"

const baseOptions = {
  host: "localhost",
  port: 1025,
  secure: false,
  from: "Tech Nest <hello@technest.co.uk>",
  reply_to: "hello@technest.co.uk",
}

function makeLogger() {
  const lines: string[] = []
  const log = (msg: string) => lines.push(msg)
  return {
    lines,
    logger: { info: log, warn: log, error: log, debug: log } as any,
  }
}

// nodemailer's jsonTransport renders the full message without a network hop.
function makeService(logger = makeLogger().logger) {
  return new SmtpNotificationService({ logger }, {
    ...baseOptions,
    transport: { jsonTransport: true },
  } as any)
}

describe("SmtpNotificationService.validateOptions", () => {
  it.each(["host", "port", "from"])("rejects missing %s", (key) => {
    const options: Record<string, unknown> = { ...baseOptions }
    delete options[key]
    expect(() => SmtpNotificationService.validateOptions(options)).toThrow(key)
  })

  it("accepts a complete config", () => {
    expect(() => SmtpNotificationService.validateOptions(baseOptions)).not.toThrow()
  })
})

describe("SmtpNotificationService.send", () => {
  it("sends pre-rendered content with from, reply-to, html and text", async () => {
    const service = makeService()
    const sendMail = jest.spyOn((service as any).transporter_, "sendMail")

    const result = await service.send({
      to: "customer@example.com",
      channel: "email",
      template: "order-confirmation",
      content: { subject: "Your order", html: "<p>Hi</p>", text: "Hi" },
    })

    expect(result.id).toEqual(expect.any(String))
    const info: any = await sendMail.mock.results[0].value
    const sent = JSON.parse(info.message)
    expect(sent.to).toEqual([{ address: "customer@example.com", name: "" }])
    expect(sent.from).toEqual({ address: "hello@technest.co.uk", name: "Tech Nest" })
    expect(sent.replyTo).toEqual([{ address: "hello@technest.co.uk", name: "" }])
    expect(sent.subject).toBe("Your order")
    expect(sent.html).toBe("<p>Hi</p>")
    expect(sent.text).toBe("Hi")
  })

  it("sends attachments (base64 content) instead of dropping them", async () => {
    const service = makeService()
    const sendMail = jest.spyOn((service as any).transporter_, "sendMail")

    await service.send({
      to: "customer@example.com",
      channel: "email",
      template: "order-confirmation",
      content: { subject: "Invoice", html: "<p>Hi</p>", text: "Hi" },
      attachments: [
        {
          filename: "invoice.pdf",
          content: Buffer.from("%PDF-1.4 test").toString("base64"),
          content_type: "application/pdf",
        },
      ],
    })

    const info: any = await sendMail.mock.results[0].value
    const sent = JSON.parse(info.message)
    expect(sent.attachments).toHaveLength(1)
    expect(sent.attachments[0].filename).toBe("invoice.pdf")
    expect(sent.attachments[0].contentType).toBe("application/pdf")
    expect(Buffer.from(sent.attachments[0].content, "base64").toString()).toBe("%PDF-1.4 test")
  })

  it("rejects a notification with no content and no renderer for the template", async () => {
    const service = makeService()

    await expect(
      service.send({ to: "a@example.com", channel: "email", template: "nope" })
    ).rejects.toThrow("nope")
  })

  it("never logs the recipient, subject or body", async () => {
    const { lines, logger } = makeLogger()
    const service = makeService(logger)

    await service.send({
      to: "secret.person@example.com",
      channel: "email",
      template: "welcome",
      content: { subject: "Private subject", html: "<p>Body 123</p>", text: "Body 123" },
    })

    const all = lines.join("\n")
    expect(all).toContain("welcome")
    expect(all).not.toContain("secret.person")
    expect(all).not.toContain("Private subject")
    expect(all).not.toContain("Body 123")
  })
})
