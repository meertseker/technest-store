import { MedusaError } from "@medusajs/framework/utils"
import { sentryErrorHandler, setSentryCaptureForTests } from "../sentry-error-handler"

function fakeRes() {
  const res: any = { statusCode: 0, body: undefined }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: unknown) => ((res.body = b), res)
  res.send = res.json
  return res
}

describe("sentryErrorHandler", () => {
  const req: any = { method: "POST", url: "/x", path: "/x", scope: { resolve: () => ({ error: () => {}, info: () => {} }) } }
  afterEach(() => setSentryCaptureForTests(undefined))

  it("reports 5xx errors and still sends Medusa's response", () => {
    const seen: unknown[] = []
    setSentryCaptureForTests((e) => seen.push(e))
    const res = fakeRes()
    sentryErrorHandler(new Error("boom"), req, res, () => {})
    expect(seen).toHaveLength(1)
    expect(res.statusCode).toBe(500)
  })

  it("does not report 4xx errors", () => {
    const seen: unknown[] = []
    setSentryCaptureForTests((e) => seen.push(e))
    const res = fakeRes()
    sentryErrorHandler(new MedusaError(MedusaError.Types.NOT_FOUND, "nope"), req, res, () => {})
    expect(seen).toHaveLength(0)
    expect(res.statusCode).toBe(404)
  })

  it("is a no-op for reporting when Sentry is off", () => {
    setSentryCaptureForTests(null)
    const res = fakeRes()
    sentryErrorHandler(new Error("boom"), req, res, () => {})
    expect(res.statusCode).toBe(500)
  })
})
