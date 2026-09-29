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

describe("SmtpNotificationService hardening (security review)", () => {
  it("requires STARTTLS when require_tls is set and implicit TLS is off", () => {
    const service = new SmtpNotificationService({ logger: makeLogger().logger }, {
      ...baseOptions,
      port: 587,
      require_tls: true,
    } as any)
    expect((service as any).transporter_.options.requireTLS).toBe(true)
  })

  it.each([
    "a@example.com, b@evil.example",
    "x@example.com\r\nBcc: evil@evil.example",
    "Name <a@example.com>; b@evil.example",
    "not-an-address",
  ])("rejects a recipient that is not exactly one address: %j", async (to) => {
    const service = makeService()
    const sendMail = jest.spyOn((service as any).transporter_, "sendMail")

    await expect(
      service.send({ to, channel: "email", template: "t", content: { subject: "s", text: "t" } })
    ).rejects.toThrow("recipient")
    expect(sendMail).not.toHaveBeenCalled()
  })

  it("never reads local files or URLs, even if a caller passes an object as content", async () => {
    const service = makeService()

    await expect(
      service.send({
        to: "customer@example.com",
        channel: "email",
        template: "t",
        content: { subject: "s", text: "t" },
        attachments: [{ filename: "x.txt", content: { path: __filename } as any }],
      })
    ).rejects.toThrow()
  })

  it("rethrows SMTP failures without the recipient address and logs no PII", async () => {
    const { lines, logger } = makeLogger()
    const service = makeService(logger)
    jest
      .spyOn((service as any).transporter_, "sendMail")
      .mockRejectedValue(
        Object.assign(new Error("Can't send mail - all recipients were rejected: 550 5.1.1 <jane.doe@example.com>: Recipient address rejected"), {
          code: "EENVELOPE",
          responseCode: 550,
          command: "RCPT TO",
        })
      )

    const error = await service
      .send({ to: "jane.doe@example.com", channel: "email", template: "welcome", content: { subject: "s", text: "t" } })
      .catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain("EENVELOPE")
    expect(error.message).toContain("550")
    expect(error.message).not.toContain("jane.doe")
    expect(lines.join("\n")).not.toContain("jane.doe")
  })
})
