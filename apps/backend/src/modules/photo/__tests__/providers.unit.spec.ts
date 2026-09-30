import { DISABLED_REASON, DisabledProvider } from "../providers/disabled"
import { RembgHttpProvider, WORKER_DOWN_REASON } from "../providers/rembg-http"
import PhotoModuleService, { createProvider } from "../service"

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("rest-of-png"),
])

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return handler(url, init)
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe("createProvider", () => {
  it("is disabled when PHOTO_WORKER_URL is unset or blank", () => {
    expect(createProvider({}).id).toBe("disabled")
    expect(createProvider({ workerUrl: "  " }).id).toBe("disabled")
  })

  it("uses the rembg HTTP provider with birefnet-general when a URL is set", () => {
    const p = createProvider({ workerUrl: "http://photo-worker:7000" })
    expect(p.id).toBe("rembg-http")
    expect(p.defaultModel).toBe("birefnet-general")
  })

  it("uses PHOTO_MODEL when it is on the allow-list (blank means the default)", () => {
    expect(createProvider({ workerUrl: "http://w", defaultModel: "isnet-general-use" }).defaultModel).toBe(
      "isnet-general-use"
    )
    expect(createProvider({ workerUrl: "http://w", defaultModel: " " }).defaultModel).toBe("birefnet-general")
  })

  it("switches photos off (instead of crashing) for a model outside the allow-list", async () => {
    const p = createProvider({ workerUrl: "http://w", defaultModel: "u2net" })
    expect(p.id).toBe("disabled")
    await expect(p.status()).resolves.toEqual({
      enabled: false,
      reason:
        'Photo processing is switched off: PHOTO_MODEL "u2net" is not allowed (use birefnet-general or isnet-general-use).',
    })
  })

  it("the HTTP provider itself refuses models outside the allow-list", () => {
    expect(() => new RembgHttpProvider({ url: "http://w", defaultModel: "u2net" as any })).toThrow(
      /Unsupported photo model/
    )
  })
})

describe("DisabledProvider", () => {
  it("reports why it is disabled and refuses to process", async () => {
    const p = new DisabledProvider()
    await expect(p.status()).resolves.toEqual({ enabled: false, reason: DISABLED_REASON })
    await expect(p.removeBackground()).rejects.toMatchObject({ type: "not_allowed", message: DISABLED_REASON })
  })

  it("the module service exposes the disabled status", async () => {
    const svc = new PhotoModuleService({}, {})
    await expect(svc.getStatus()).resolves.toEqual({
      enabled: false,
      reason: DISABLED_REASON,
      provider: "disabled",
      default_model: null,
    })
  })
})

describe("RembgHttpProvider", () => {
  it("posts the image with the model named explicitly and returns the PNG", async () => {
    const { fn, calls } = fakeFetch(() => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }))
    const p = new RembgHttpProvider({ url: "http://photo-worker:7000/", fetch: fn })
    const out = await p.removeBackground(Buffer.from("img"))

    expect(out.model).toBe("birefnet-general")
    expect(out.png.equals(PNG)).toBe(true)
    expect(calls[0].url).toBe("http://photo-worker:7000/remove")
    expect(calls[0].init?.method).toBe("POST")
    const form = calls[0].init?.body as FormData
    expect(form.get("model")).toBe("birefnet-general")
    expect(form.get("file")).toBeInstanceOf(Blob)
  })

  it("can use the faster fallback model", async () => {
    const { fn, calls } = fakeFetch(() => new Response(PNG))
    const p = new RembgHttpProvider({ url: "http://w", fetch: fn })
    const out = await p.removeBackground(Buffer.from("img"), { model: "isnet-general-use" })
    expect(out.model).toBe("isnet-general-use")
    expect((calls[0].init?.body as FormData).get("model")).toBe("isnet-general-use")
  })

  it("turns worker errors into readable Medusa errors", async () => {
    const p = new RembgHttpProvider({
      url: "http://w",
      fetch: fakeFetch(() => new Response("boom", { status: 500 })).fn,
    })
    await expect(p.removeBackground(Buffer.from("x"))).rejects.toMatchObject({
      type: "unexpected_state",
      message: "The photo worker failed (HTTP 500): boom",
    })
  })

  it("rejects a non-PNG response", async () => {
    const p = new RembgHttpProvider({ url: "http://w", fetch: fakeFetch(() => new Response("{}")).fn })
    await expect(p.removeBackground(Buffer.from("x"))).rejects.toThrow("did not return a PNG")
  })

  it("reports unreachable and timed-out workers", async () => {
    const down = new RembgHttpProvider({
      url: "http://w",
      fetch: fakeFetch(() => {
        throw new TypeError("fetch failed")
      }).fn,
    })
    await expect(down.removeBackground(Buffer.from("x"))).rejects.toThrow("The photo worker is unreachable")

    const slow = new RembgHttpProvider({
      url: "http://w",
      timeoutMs: 5_000,
      fetch: fakeFetch(() => {
        const e = new Error("timeout")
        e.name = "TimeoutError"
        throw e
      }).fn,
    })
    await expect(slow.removeBackground(Buffer.from("x"))).rejects.toThrow("timed out after 5 s")
  })

  it("status pings /health", async () => {
    const ok = fakeFetch(() => new Response("{}"))
    await expect(new RembgHttpProvider({ url: "http://w", fetch: ok.fn }).status()).resolves.toEqual({
      enabled: true,
      reason: null,
    })
    expect(ok.calls[0].url).toBe("http://w/health")

    const bad = fakeFetch(() => {
      throw new TypeError("fetch failed")
    })
    await expect(new RembgHttpProvider({ url: "http://w", fetch: bad.fn }).status()).resolves.toEqual({
      enabled: false,
      reason: WORKER_DOWN_REASON,
    })
  })
})
