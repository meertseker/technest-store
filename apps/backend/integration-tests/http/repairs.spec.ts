import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { asValue } from "@medusajs/framework/awilix"
import { createStep, createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { seedTechNest } from "../../src/scripts/seed"
import { TURNSTILE_VERIFIER_KEY } from "../../src/lib/turnstile"
import { REPAIR_MODULE } from "../../src/modules/repair"
import RepairModuleService from "../../src/modules/repair/service"
import { updateRepairBookingStep } from "../../src/workflows/steps/repair-booking-steps"
import { createRepairBookingWorkflow } from "../../src/workflows/create-repair-booking"
import { adminHeaders, storeHeaders } from "../helpers/auth"
import { spyOnEvents } from "../helpers/events"

jest.setTimeout(10 * 60 * 1000)

// Runs the real update step, then fails, to prove the step's compensation.
const failingStep = createStep("test-fail-after-repair-update", async () => {
  throw new Error("later step failed")
})
const updateThenFailWorkflow = createWorkflow(
  "test-update-repair-booking-then-fail",
  function (input: { id: string; status: "done"; notes: string }) {
    const booking = updateRepairBookingStep(input)
    failingStep()
    return new WorkflowResponse(booking)
  }
)

type Headers = { headers: Record<string, string> }

const booking = (over: Record<string, unknown> = {}) => ({
  name: "Sam Jones",
  phone: "07700 900123",
  email: "sam@example.com",
  device: "iPhone 13 mini",
  fault: "Cracked screen, touch still works",
  preferred_time: "Weekday mornings",
  turnstile_token: "good-token",
  ...over,
})

// The runner snapshots the DB after beforeAll and restores it before every
// test, so fixtures live in beforeAll and each test starts from them.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: Headers
    let store: Headers
    let deviceId: string
    let events: ReturnType<typeof spyOnEvents>
    const ids: Record<string, string> = {}
    const verifier = jest.fn(async (token: string, _ip?: string) => token === "good-token")
    let ipCounter = 0

    // Every request gets its own client IP so the per-IP limit never leaks between tests.
    const fromIp = (ip = `198.51.100.${++ipCounter}`) => ({
      headers: { ...store.headers, "cf-connecting-ip": ip },
    })
    const fail = (p: Promise<unknown>): Promise<any> => p.catch((e: any) => e.response)

    beforeAll(async () => {
      const container = getContainer()
      container.register(TURNSTILE_VERIFIER_KEY, asValue(verifier))
      await seedTechNest(container)
      admin = await adminHeaders(api, container)
      store = await storeHeaders(container)

      const { data: device } = await api.post(
        "/admin/devices",
        { brand: "Apple", series: "iPhone 13", model: "iPhone 13 mini", type: "phone" },
        admin
      )
      deviceId = device.device.id

      for (const [key, over] of [
        ["first", { name: "First" }],
        ["second", { name: "Second", device_id: deviceId }],
        ["third", { name: "Third" }],
      ] as const) {
        const { data } = await api.post("/store/repair-bookings", booking(over), fromIp())
        ids[key] = data.repair_booking.id
      }
      await api.post(`/admin/repair-bookings/${ids.second}`, { status: "booked" }, admin)
      await api.post(`/admin/repair-bookings/${ids.third}`, { status: "done" }, admin)

      events = spyOnEvents(container)
    })

    beforeEach(() => {
      events.spy.mockClear()
      verifier.mockClear()
    })

    describe("store: POST /store/repair-bookings", () => {
      it("creates a booking without echoing personal data and emits created", async () => {
        const { data } = await api.post(
          "/store/repair-bookings",
          booking({ device_id: deviceId }),
          fromIp("203.0.113.7")
        )
        expect(data).toEqual({ repair_booking: { id: expect.stringMatching(/^rep_/), status: "new" } })
        expect(verifier).toHaveBeenCalledWith("good-token", "203.0.113.7")
        expect(events.emitted("technest.repair_booking.created")).toEqual([{ id: data.repair_booking.id }])

        const { data: stored } = await api.get(`/admin/repair-bookings/${data.repair_booking.id}`, admin)
        expect(stored.repair_booking).toEqual({
          id: data.repair_booking.id,
          name: "Sam Jones",
          phone: "07700 900123",
          email: "sam@example.com",
          device: "iPhone 13 mini",
          device_id: deviceId,
          fault: "Cracked screen, touch still works",
          preferred_time: "Weekday mornings",
          status: "new",
          notes: null,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      })

      it("rejects a failed Turnstile check and stores nothing", async () => {
        const err = await fail(api.post("/store/repair-bookings", booking({ turnstile_token: "bad" }), fromIp()))
        expect(err.status).toBe(400)
        expect(err.data).toMatchObject({ type: "not_allowed", message: "Turnstile verification failed" })
        const { data } = await api.get("/admin/repair-bookings", admin)
        expect(data.count).toBe(3)
        expect(events.emitted("technest.repair_booking.created")).toEqual([])
      })

      it("validates the body", async () => {
        const cases = [
          booking({ turnstile_token: undefined }),
          booking({ email: "not-an-email" }),
          booking({ phone: "ring me" }),
          booking({ name: " " }),
          booking({ fault: "" }),
          booking({ preferred_time: undefined }),
          booking({ status: "done" }),
        ]
        for (const body of cases) {
          const err = await fail(api.post("/store/repair-bookings", body, fromIp()))
          expect(err.status).toBe(400)
        }
        expect(verifier).not.toHaveBeenCalled()
      })

      it("rejects an unknown device_id", async () => {
        const err = await fail(api.post("/store/repair-bookings", booking({ device_id: "dev_missing" }), fromIp()))
        expect(err.status).toBe(400)
        expect(err.data.message).toContain("dev_missing")
      })

      it("limits each client IP to 5 attempts per 10 minutes", async () => {
        const ip = "192.0.2.50"
        for (let i = 0; i < 4; i++) {
          await api.post("/store/repair-bookings", booking(), fromIp(ip))
        }
        // Invalid attempts count too.
        expect((await fail(api.post("/store/repair-bookings", { name: "x" }, fromIp(ip)))).status).toBe(400)
        const limited = await fail(api.post("/store/repair-bookings", booking(), fromIp(ip)))
        expect(limited.status).toBe(429)
        expect(limited.data).toEqual({
          type: "too_many_requests",
          message: "Too many repair bookings, please try again later",
        })
        expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0)

        // Another client is unaffected.
        const other = await api.post("/store/repair-bookings", booking(), fromIp("192.0.2.51"))
        expect(other.status).toBe(200)
      })

      it("rolls back the booking when a later step fails", async () => {
        const container = getContainer()
        events.failNext("technest.repair_booking.created")
        const { errors } = await createRepairBookingWorkflow(container).run({
          input: {
            name: "Rollback",
            phone: "07700 900000",
            email: "rb@example.com",
            device: "Pixel 8",
            fault: "Battery",
            preferred_time: "Any",
          },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const repairService: RepairModuleService = container.resolve(REPAIR_MODULE)
        expect(await repairService.listRepairBookings({ name: "Rollback" })).toHaveLength(0)
      })
    })

    describe("admin", () => {
      it("requires admin auth", async () => {
        expect((await fail(api.get("/admin/repair-bookings"))).status).toBe(401)
        expect((await fail(api.get(`/admin/repair-bookings/${ids.first}`))).status).toBe(401)
        expect((await fail(api.post(`/admin/repair-bookings/${ids.first}`, { status: "done" }))).status).toBe(401)
        // The store route never exposes bookings.
        expect((await fail(api.get("/store/repair-bookings", store))).status).toBe(404)
      })

      it("lists newest first with status filter and pagination", async () => {
        const all = await api.get("/admin/repair-bookings", admin)
        expect(all.data).toMatchObject({ count: 3, limit: 20, offset: 0 })
        expect(all.data.repair_bookings.map((b: any) => b.name)).toEqual(["Third", "Second", "First"])

        const open = await api.get("/admin/repair-bookings?status=new&status=booked", admin)
        expect(open.data.repair_bookings.map((b: any) => b.name)).toEqual(["Second", "First"])

        const page = await api.get("/admin/repair-bookings?limit=1&offset=1&order=created_at", admin)
        expect(page.data).toMatchObject({ count: 3, limit: 1, offset: 1 })
        expect(page.data.repair_bookings.map((b: any) => b.name)).toEqual(["Second"])

        expect((await fail(api.get("/admin/repair-bookings?status=lost", admin))).status).toBe(400)
      })

      it("gets one booking or 404", async () => {
        const { data } = await api.get(`/admin/repair-bookings/${ids.second}`, admin)
        expect(data.repair_booking).toMatchObject({ name: "Second", device_id: deviceId, status: "booked" })
        expect((await fail(api.get("/admin/repair-bookings/rep_missing", admin))).status).toBe(404)
      })

      it("updates status and notes", async () => {
        const { data } = await api.post(
          `/admin/repair-bookings/${ids.first}`,
          { status: "booked", notes: "Called back, booked Tue 10:00" },
          admin
        )
        expect(data.repair_booking).toMatchObject({ status: "booked", notes: "Called back, booked Tue 10:00" })

        const { data: cleared } = await api.post(`/admin/repair-bookings/${ids.first}`, { notes: null }, admin)
        expect(cleared.repair_booking).toMatchObject({ status: "booked", notes: null })
      })

      it("rejects an empty or invalid update and unknown ids", async () => {
        expect((await fail(api.post(`/admin/repair-bookings/${ids.first}`, {}, admin))).status).toBe(400)
        expect((await fail(api.post(`/admin/repair-bookings/${ids.first}`, { status: "lost" }, admin))).status).toBe(400)
        expect((await fail(api.post("/admin/repair-bookings/rep_missing", { status: "done" }, admin))).status).toBe(404)
      })

      it("update workflow restores the previous values on rollback", async () => {
        const container = getContainer()
        const { errors } = await updateThenFailWorkflow(container).run({
          input: { id: ids.second, status: "done", notes: "should not stick" },
          throwOnError: false,
        })
        expect(errors.length).toBeGreaterThan(0)
        const repairService: RepairModuleService = container.resolve(REPAIR_MODULE)
        expect(await repairService.retrieveRepairBooking(ids.second)).toMatchObject({ status: "booked", notes: null })
      })
    })
  },
})
