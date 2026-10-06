import net from "node:net"
import { setAlertSinkForTests, type Alert } from "../../alerting"
import { checkSmtpLogin } from "../../../modules/smtp/service"
import { checkSmtpAtStart, resetSmtpCheckForTests, smtpOptionsOf } from "../smtp-check"

const options = { host: "smtp.example.com", port: 587, user: "resend", pass: "re_secret", from: "Tech Nest <orders@technest.co.uk>" }

function logger() {
  const lines: string[] = []
  const log = (m: string) => lines.push(m)
  return { lines, info: log, warn: log, error: log }
}

describe("checkSmtpAtStart", () => {
  let alerts: Alert[]
  beforeEach(() => {
    alerts = []
    setAlertSinkForTests((a) => alerts.push(a))
    resetSmtpCheckForTests()
  })
  afterEach(() => setAlertSinkForTests(undefined))

  it("checks once and stays quiet when the login works", async () => {
    const check = jest.fn(async () => ({ ok: true as const }))
    const log = logger()
    await checkSmtpAtStart(options, log, check)
    await checkSmtpAtStart(options, log, check)
    expect(check).toHaveBeenCalledTimes(1)
    expect(alerts).toEqual([])
  })

  it("raises one alert when the login is refused, keeps checking, and never shows the password", async () => {
    const check = jest.fn(async () => ({ ok: false as const, summary: "code=EAUTH response_code=535 command=AUTH PLAIN" }))
    const log = logger()
    await checkSmtpAtStart(options, log, check)
    await checkSmtpAtStart(options, log, check)
    expect(check).toHaveBeenCalledTimes(2)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toContain("EAUTH")
    expect(alerts[0].message).toContain("SMTP_PASS")
    expect(JSON.stringify(alerts) + log.lines.join("\n")).not.toContain("re_secret")

    check.mockResolvedValue({ ok: true } as any)
    await checkSmtpAtStart(options, log, check)
    await checkSmtpAtStart(options, log, check)
    expect(check).toHaveBeenCalledTimes(3)
    expect(alerts).toHaveLength(1)
  })

  it("never throws", async () => {
    const check = jest.fn(async () => {
      throw new Error("boom")
    })
    await expect(checkSmtpAtStart(options, logger(), check as any)).resolves.toBeUndefined()
    expect(alerts).toHaveLength(1)
  })
})

describe("checkSmtpLogin", () => {
  it("reports a server that can't be reached by its error code", async () => {
    // A port nothing listens on.
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const port = (server.address() as net.AddressInfo).port
    await new Promise((resolve) => server.close(resolve))

    const result = await checkSmtpLogin({ ...options, host: "127.0.0.1", port })
    expect(result.ok).toBe(false)
    expect((result as { summary: string }).summary).toMatch(/code=E(CONNECTION|SOCKET|CONNREFUSED)/)
  })
})

describe("smtpOptionsOf", () => {
  it("finds the smtp provider's options in the app config", () => {
    const container = {
      resolve: () => ({
        modules: { notification: { options: { providers: [{ id: "smtp", options }] } } },
      }),
    } as any
    expect(smtpOptionsOf(container)).toBe(options)
  })

  it("returns null when they are not there", () => {
    expect(smtpOptionsOf({ resolve: () => ({ modules: {} }) } as any)).toBeNull()
    expect(
      smtpOptionsOf({
        resolve: () => {
          throw new Error("no config")
        },
      } as any)
    ).toBeNull()
  })
})
