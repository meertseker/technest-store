import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUTH_LIMITS } from "../../src/lib/auth-throttle"
import { seedTechNest } from "../../src/scripts/seed"
import { storeHeaders } from "../helpers/auth"
import { waitForBackgroundWork } from "../helpers/background"

jest.setTimeout(10 * 60 * 1000)

type Headers = { headers: Record<string, string> }
type Reply = { status: number; headers: Record<string, string>; data: any }

// Sign-in, registration, password reset and trade applications are counted per
// visitor IP (the CF-Connecting-IP header Caddy sets) and per email address.
// Counters live in the API process for the whole suite and a failed test is
// retried, so every test takes addresses and emails nobody used before.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let store: Headers
    let serial = 0
    const run = Date.now().toString(36)

    const newIp = () => {
      serial += 1
      return `198.18.${Math.floor(serial / 250)}.${(serial % 250) + 1}`
    }
    const newEmail = (label = "shopper") => `${label}-${run}-${++serial}@throttle.test`
    const from = (ip: string, headers: Record<string, string> = {}) => ({
      headers: { "cf-connecting-ip": ip, ...headers },
    })
    const post = (url: string, body: unknown, config: Headers): Promise<Reply> =>
      api.post(url, body, config).catch((e: any) => e.response)
    const password = "correct-horse-battery-staple"

    const expectRefused = (reply: Reply) => {
      expect(reply.status).toBe(429)
      expect(reply.data).toEqual({ type: "too_many_requests", message: expect.stringContaining("Too many attempts") })
      expect(Number(reply.headers["retry-after"])).toBeGreaterThan(0)
    }

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      store = await storeHeaders(container)
      await waitForBackgroundWork(container)
    })

    afterEach(() => waitForBackgroundWork(getContainer()))

    describe("customer sign-in (POST /auth/customer/emailpass)", () => {
      it("refuses further attempts on one email, from any address", async () => {
        const email = newEmail()
        const limit = AUTH_LIMITS.customerLogin.email.limit
        for (let i = 0; i < limit; i++) {
          const reply = await post("/auth/customer/emailpass", { email, password: `wrong-${i}` }, from(newIp()))
          expect(reply.status).toBe(401)
        }
        expectRefused(await post("/auth/customer/emailpass", { email, password: "wrong" }, from(newIp())))
        // The same email in capitals is the same account.
        expectRefused(await post("/auth/customer/emailpass", { email: email.toUpperCase(), password: "wrong" }, from(newIp())))
        // Somebody else can still sign in.
        const other = await post("/auth/customer/emailpass", { email: newEmail(), password: "wrong" }, from(newIp()))
        expect(other.status).toBe(401)
      })

      it("refuses further attempts from one address, whatever the email", async () => {
        const ip = newIp()
        const limit = AUTH_LIMITS.customerLogin.ip.limit
        for (let i = 0; i < limit; i++) {
          const reply = await post("/auth/customer/emailpass", { email: newEmail(), password: "wrong" }, from(ip))
          expect(reply.status).toBe(401)
        }
        expectRefused(await post("/auth/customer/emailpass", { email: newEmail(), password: "wrong" }, from(ip)))
        const elsewhere = await post("/auth/customer/emailpass", { email: newEmail(), password: "wrong" }, from(newIp()))
        expect(elsewhere.status).toBe(401)
      })

      it("a correct password clears the count for that email", async () => {
        const email = newEmail()
        const registered = await post("/auth/customer/emailpass/register", { email, password }, from(newIp()))
        expect(registered.status).toBe(200)

        const limit = AUTH_LIMITS.customerLogin.email.limit
        for (let i = 0; i < limit - 1; i++) {
          expect((await post("/auth/customer/emailpass", { email, password: "wrong" }, from(newIp()))).status).toBe(401)
        }
        const ok = await post("/auth/customer/emailpass", { email, password }, from(newIp()))
        expect(ok.status).toBe(200)
        expect(ok.data.token).toEqual(expect.any(String))

        // Without the reset this would be attempt limit + 1.
        const next = await post("/auth/customer/emailpass", { email, password: "wrong" }, from(newIp()))
        expect(next.status).toBe(401)
      })
    })

    describe("registration (POST /auth/customer/emailpass/register)", () => {
      it("refuses further accounts from one address", async () => {
        const ip = newIp()
        const limit = AUTH_LIMITS.register.ip.limit
        for (let i = 0; i < limit; i++) {
          const reply = await post("/auth/customer/emailpass/register", { email: newEmail(), password }, from(ip))
          expect(reply.status).toBe(200)
        }
        expectRefused(await post("/auth/customer/emailpass/register", { email: newEmail(), password }, from(ip)))
        const elsewhere = await post("/auth/customer/emailpass/register", { email: newEmail(), password }, from(newIp()))
        expect(elsewhere.status).toBe(200)
      })

      it("refuses further customer records from one address (POST /store/customers)", async () => {
        const ip = newIp()
        const limit = AUTH_LIMITS.createCustomer.ip.limit
        const create = async () => {
          const email = newEmail()
          // Each identity is registered from its own address: only the second step is under test.
          const { data } = await post("/auth/customer/emailpass/register", { email, password }, from(newIp()))
          return post(
            "/store/customers",
            { email, first_name: "Test", last_name: "Shopper" },
            from(ip, { ...store.headers, authorization: `Bearer ${data.token}` })
          )
        }
        for (let i = 0; i < limit; i++) {
          expect((await create()).status).toBe(200)
        }
        expectRefused(await create())
      })
    })

    describe("password reset request (POST /auth/customer/emailpass/reset-password)", () => {
      it("refuses further requests for one email, from any address", async () => {
        const identifier = newEmail()
        const limit = AUTH_LIMITS.resetRequest.email.limit
        for (let i = 0; i < limit; i++) {
          const reply = await post("/auth/customer/emailpass/reset-password", { identifier }, from(newIp()))
          expect(reply.status).toBe(201)
        }
        expectRefused(await post("/auth/customer/emailpass/reset-password", { identifier }, from(newIp())))
      })

      it("refuses further requests from one address", async () => {
        const ip = newIp()
        const limit = AUTH_LIMITS.resetRequest.ip.limit
        for (let i = 0; i < limit; i++) {
          const reply = await post("/auth/customer/emailpass/reset-password", { identifier: newEmail() }, from(ip))
          expect(reply.status).toBe(201)
        }
        expectRefused(await post("/auth/customer/emailpass/reset-password", { identifier: newEmail() }, from(ip)))
      })
    })

    describe("trade application (POST /store/trade-applications)", () => {
      it("refuses further applications from one address", async () => {
        const ip = newIp()
        const limit = AUTH_LIMITS.tradeApplication.ip.limit
        const application = (email: string) => ({
          company_name: "Acme Phones Ltd",
          vat_number: null,
          companies_house_number: null,
          business_type: "sole_trader",
          contact: { name: "Jane Smith", phone: "020 7946 0000", email },
        })
        // A new customer for each application (one customer may only have one pending).
        const apply = async () => {
          const email = newEmail("trader")
          const { data: registered } = await post("/auth/customer/emailpass/register", { email, password }, from(newIp()))
          await post(
            "/store/customers",
            { email, first_name: "Test", last_name: "Trader" },
            from(newIp(), { ...store.headers, authorization: `Bearer ${registered.token}` })
          )
          const { data: login } = await post("/auth/customer/emailpass", { email, password }, from(newIp()))
          return post(
            "/store/trade-applications",
            application(email),
            from(ip, { ...store.headers, authorization: `Bearer ${login.token}` })
          )
        }
        for (let i = 0; i < limit; i++) {
          const reply = await apply()
          expect(reply.status).toBe(200)
          expect(reply.data.trade_application.status).toBe("pending")
        }
        expectRefused(await apply())
      })
    })

    describe("admin sign-in (POST /auth/user/emailpass)", () => {
      it("has tighter limits than customer sign-in", () => {
        expect(AUTH_LIMITS.adminLogin.email.limit).toBeLessThan(AUTH_LIMITS.customerLogin.email.limit)
        expect(AUTH_LIMITS.adminLogin.ip.limit).toBeLessThan(AUTH_LIMITS.customerLogin.ip.limit)
      })

      it("refuses further attempts on one admin email", async () => {
        const email = newEmail("staff")
        const limit = AUTH_LIMITS.adminLogin.email.limit
        for (let i = 0; i < limit; i++) {
          expect((await post("/auth/user/emailpass", { email, password: "wrong" }, from(newIp()))).status).toBe(401)
        }
        expectRefused(await post("/auth/user/emailpass", { email, password: "wrong" }, from(newIp())))
      })

      it("refuses further attempts from one address", async () => {
        const ip = newIp()
        const limit = AUTH_LIMITS.adminLogin.ip.limit
        for (let i = 0; i < limit; i++) {
          expect((await post("/auth/user/emailpass", { email: newEmail("staff"), password: "wrong" }, from(ip))).status).toBe(401)
        }
        expectRefused(await post("/auth/user/emailpass", { email: newEmail("staff"), password: "wrong" }, from(ip)))
      })

      it("is counted apart from customer sign-in for the same email", async () => {
        const email = newEmail("both")
        for (let i = 0; i < AUTH_LIMITS.adminLogin.email.limit; i++) {
          await post("/auth/user/emailpass", { email, password: "wrong" }, from(newIp()))
        }
        expectRefused(await post("/auth/user/emailpass", { email, password: "wrong" }, from(newIp())))
        const asCustomer = await post("/auth/customer/emailpass", { email, password: "wrong" }, from(newIp()))
        expect(asCustomer.status).toBe(401)
      })
    })

    describe("what is not counted", () => {
      it("the payment webhook is never refused for volume", async () => {
        const ip = newIp()
        const statuses = new Set<number>()
        for (let i = 0; i < 40; i++) {
          const reply = await post("/hooks/payment/stripe_stripe", { id: `evt_${i}` }, from(ip))
          statuses.add(reply.status)
        }
        expect([...statuses]).not.toContain(429)
      })

      it("a caller on the internal network without a visitor address is counted per email only", async () => {
        const limit = AUTH_LIMITS.register.ip.limit
        for (let i = 0; i < limit + 2; i++) {
          const reply = await post("/auth/customer/emailpass/register", { email: newEmail(), password }, { headers: {} })
          expect(reply.status).toBe(200)
        }
        // ...but one email is still limited.
        const email = newEmail()
        for (let i = 0; i < AUTH_LIMITS.customerLogin.email.limit; i++) {
          await post("/auth/customer/emailpass", { email, password: "wrong" }, { headers: {} })
        }
        expectRefused(await post("/auth/customer/emailpass", { email, password: "wrong" }, { headers: {} }))
      })
    })
  },
})
