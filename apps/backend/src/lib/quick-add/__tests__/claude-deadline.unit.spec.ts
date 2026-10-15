import { AnthropicStub, startAnthropicStub } from "../../../../integration-tests/helpers/anthropic"
import { analyzeProductPhoto, mapError } from "../claude"
import { QuickAddCatalogue } from "../suggestion"

/**
 * The analyse call sits inside one synchronous admin request that a proxy
 * cuts off after about two minutes. These tests pin the whole call, retries
 * included, under the configured deadline.
 */

const catalogue: QuickAddCatalogue = { categories: [], devices: [] }
const image = { media_type: "image/jpeg" as const, data: Buffer.from("not really a jpeg").toString("base64") }

const ANSWER = {
  is_product_photo: true,
  title: "Anker 20W USB-C Wall Charger",
  description: "Compact 20W USB-C wall charger with a UK plug.",
  category_handle: "chargers-cables",
  product_type: "charger",
  compatible_device_slugs: [],
  safety_marking: "UKCA",
  safety_marking_evidence: "UKCA mark on the box",
  connector_a: "USB-C",
  connector_b: null,
  wattage: 20,
  cable_length_m: null,
  suggested_price_gbp: 14.99,
  looks_like_vape: false,
  confidence: "high",
  notes: "Check the plug type.",
}

const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 5))
  return check()
}

describe("analyzeProductPhoto deadline", () => {
  let stub: AnthropicStub
  const env = { ...process.env }

  beforeAll(async () => {
    stub = await startAnthropicStub()
  })
  afterAll(async () => {
    await stub.close()
  })
  beforeEach(() => {
    stub.mode = "ok"
    stub.answer = ANSWER
    stub.requests.length = 0
    stub.retryAfter = 1
    process.env.ANTHROPIC_API_KEY = "sk-ant-unit-test"
    process.env.ANTHROPIC_BASE_URL = stub.url
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("answers within the deadline when Claude never replies, without retrying the timeout", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "300"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "1000"
    stub.mode = "slow"

    const started = Date.now()
    const result = await analyzeProductPhoto({ image, catalogue })
    const elapsed = Date.now() - started

    expect(result).toMatchObject({ ok: false, code: "ai_timeout" })
    // One attempt only: a retried timeout would double the wait.
    expect(stub.requests).toHaveLength(1)
    expect(elapsed).toBeLessThan(1000 + 5000)
    expect(elapsed).toBeLessThan(900)
  })

  it("caps a long per-attempt timeout at the deadline", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "60000"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "400"
    stub.mode = "slow"

    const started = Date.now()
    const result = await analyzeProductPhoto({ image, catalogue })
    expect(result).toMatchObject({ ok: false, code: "ai_timeout" })
    expect(Date.now() - started).toBeLessThan(400 + 5000)
    expect(stub.requests).toHaveLength(1)
  })

  it("retries a server error once when there is time left, and then succeeds", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "5000"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "20000"
    stub.mode = "error500"

    const pending = analyzeProductPhoto({ image, catalogue })
    expect(await until(() => stub.requests.length === 1)).toBe(true)
    stub.mode = "ok"
    const result = await pending

    expect(result).toMatchObject({ ok: true, model: "claude-opus-5-5" })
    expect(stub.requests).toHaveLength(2)
  })

  it("does not start a second attempt that could not finish inside the deadline", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "5000"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "2000"
    stub.mode = "error500"

    const started = Date.now()
    const result = await analyzeProductPhoto({ image, catalogue })

    expect(result).toMatchObject({ ok: false, code: "ai_unavailable" })
    expect(stub.requests).toHaveLength(1)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it("waits as long as a rate limit asks before the second attempt", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "5000"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "20000"
    stub.mode = "rate_limited"
    stub.retryAfter = 1

    const started = Date.now()
    const pending = analyzeProductPhoto({ image, catalogue })
    expect(await until(() => stub.requests.length === 1)).toBe(true)
    stub.mode = "ok"
    const result = await pending

    expect(result).toMatchObject({ ok: true })
    expect(stub.requests).toHaveLength(2)
    expect(Date.now() - started).toBeGreaterThanOrEqual(950)
  })

  it("does not retry a rate limit whose wait would not leave time for another attempt", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "5000"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "20000"
    stub.mode = "rate_limited"
    stub.retryAfter = 20

    const started = Date.now()
    const result = await analyzeProductPhoto({ image, catalogue })
    expect(result).toMatchObject({ ok: false, code: "ai_unavailable" })
    expect(stub.requests).toHaveLength(1)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it("never retries a rejected key", async () => {
    process.env.QUICK_ADD_AI_TIMEOUT_MS = "5000"
    process.env.QUICK_ADD_AI_DEADLINE_MS = "20000"
    stub.mode = "unauthorized"

    const result = await analyzeProductPhoto({ image, catalogue })
    expect(result).toMatchObject({ ok: false, code: "ai_unavailable" })
    expect(stub.requests).toHaveLength(1)
  })

  it("maps an aborted request (deadline hit while reading the answer) to a timeout", () => {
    const Anthropic = require("@anthropic-ai/sdk").default
    expect(mapError(new Anthropic.APIUserAbortError())).toMatchObject({ ok: false, code: "ai_timeout" })
  })
})
