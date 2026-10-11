import sharp from "sharp"
import { FAL_BIREFNET_URL, FalProvider, MAX_RESULT_BYTES } from "../providers/fal"

const KEY = "fal-test-key"

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return handler(url, init)
  }) as unknown as typeof fetch
  return { fn, calls }
}

const dataUri = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const rgba = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } })
    .png()
    .toBuffer()

describe("FalProvider", () => {
  let photo: Buffer
  let cutout: Buffer

  beforeAll(async () => {
    photo = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#c0c0c0" } })
      .png()
      .toBuffer()
    cutout = await rgba(200, 100)
  })

  it("status is enabled without calling fal", async () => {
    const { fn, calls } = fakeFetch(() => json({}))
    await expect(new FalProvider({ apiKey: KEY, fetch: fn }).status()).resolves.toEqual({
      enabled: true,
      reason: null,
    })
    expect(calls).toHaveLength(0)
  })

  it("sends a JPEG copy to BiRefNet with the key and returns the inline PNG", async () => {
    const { fn, calls } = fakeFetch(() => json({ image: { url: dataUri(cutout), content_type: "image/png" } }))
    const out = await new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(photo)

    expect(out.model).toBe("birefnet-general")
    expect(out.png.equals(cutout)).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(FAL_BIREFNET_URL)
    expect(calls[0].init?.method).toBe("POST")
    expect(calls[0].init?.headers).toEqual({ Authorization: `Key ${KEY}`, "Content-Type": "application/json" })
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body).toMatchObject({
      model: "General Use (Heavy)",
      operating_resolution: "1024x1024",
      refine_foreground: false,
      output_format: "png",
      sync_mode: true,
    })
    const sent = Buffer.from(body.image_url.replace("data:image/jpeg;base64,", ""), "base64")
    await expect(sharp(sent).metadata()).resolves.toMatchObject({ format: "jpeg", width: 200, height: 100 })
  })

  it("downloads the PNG when fal answers with a link, without sending the key there", async () => {
    const { fn, calls } = fakeFetch((url) =>
      url === FAL_BIREFNET_URL
        ? json({ image: { url: "https://v3.fal.media/files/out.png" } })
        : new Response(new Uint8Array(cutout), { status: 200 })
    )
    const out = await new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(photo)
    expect(out.png.equals(cutout)).toBe(true)
    expect(calls[1].url).toBe("https://v3.fal.media/files/out.png")
    expect(calls[1].init?.headers).toBeUndefined()
    // One deadline for the whole photo, not a fresh one per request.
    expect(calls[1].init?.signal).toBe(calls[0].init?.signal)
  })

  it("reports a timeout when the deadline passes while the answer is still arriving", async () => {
    const cutOff = {
      ok: true,
      status: 200,
      json: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80))
        const e = new Error("The operation was aborted due to timeout")
        e.name = "TimeoutError"
        throw e
      },
    } as unknown as Response
    const p = new FalProvider({ apiKey: KEY, timeoutMs: 20, fetch: fakeFetch(() => cutOff).fn })
    await expect(p.removeBackground(photo)).rejects.toThrow("The photo service timed out after 0 s")
  })

  it("refuses a link that is not https", async () => {
    const { fn, calls } = fakeFetch(() => json({ image: { url: "http://169.254.169.254/latest" } }))
    await expect(new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(photo)).rejects.toThrow(
      "returned an unreadable image"
    )
    expect(calls).toHaveLength(1)
  })

  it("only runs birefnet-general and does not call fal for another model", async () => {
    const { fn, calls } = fakeFetch(() => json({}))
    await expect(
      new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(photo, { model: "isnet-general-use" })
    ).rejects.toMatchObject({
      type: "invalid_data",
      message: "The hosted photo service only runs birefnet-general (asked for isnet-general-use)",
    })
    expect(calls).toHaveLength(0)
  })

  it("rejects an input that is not an image before calling fal", async () => {
    const { fn, calls } = fakeFetch(() => json({}))
    await expect(
      new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(Buffer.from("x"))
    ).rejects.toMatchObject({ type: "invalid_data", message: "The photo could not be read" })
    expect(calls).toHaveLength(0)
  })

  it("turns fal errors into readable messages that never contain the key", async () => {
    const run = (res: () => Response) =>
      new FalProvider({ apiKey: KEY, fetch: fakeFetch(res).fn }).removeBackground(photo).catch((e) => e)

    for (const status of [401, 403]) {
      await expect(run(() => json({ detail: `bad key ${KEY}` }, status))).resolves.toMatchObject({
        type: "unexpected_state",
        message: "The photo service refused our account (check the key and the balance)",
      })
    }
    await expect(run(() => json({ detail: "slow down" }, 429))).resolves.toMatchObject({
      message: "The photo service is busy. Try again in a minute.",
    })
    await expect(
      run(() => json({ detail: [{ msg: "field required" }, { msg: "bad enum" }] }, 422))
    ).resolves.toMatchObject({ message: "The photo service failed (HTTP 422): field required; bad enum" })
    await expect(run(() => new Response("<html>bad gateway</html>", { status: 502 }))).resolves.toMatchObject({
      message: "The photo service failed (HTTP 502)",
    })
  })

  it("rejects an answer without an image, a non-PNG and a mask of another shape", async () => {
    const run = (body: unknown) =>
      new FalProvider({ apiKey: KEY, fetch: fakeFetch(() => json(body)).fn }).removeBackground(photo)

    await expect(run({})).rejects.toThrow("did not return an image")
    await expect(
      run({ image: { url: "data:image/png;base64," + Buffer.from("nope").toString("base64") } })
    ).rejects.toThrow("did not return a PNG")
    await expect(run({ image: { url: dataUri(await rgba(100, 100)) } })).rejects.toThrow("different shape")

    // Same shape at another size is fine: the pipeline resizes the alpha onto the original.
    await expect(run({ image: { url: dataUri(await rgba(100, 50)) } })).resolves.toMatchObject({
      model: "birefnet-general",
    })
  })

  describe("one retry inside the deadline", () => {
    const answer = () => json({ image: { url: dataUri(cutout) } })

    it.each([502, 503, 504])("retries once after an HTTP %i and then uses the answer", async (status) => {
      let n = 0
      const { fn, calls } = fakeFetch(() => (++n === 1 ? json({ detail: "cold start" }, status) : answer()))
      const out = await new FalProvider({ apiKey: KEY, fetch: fn, retryPauseMs: 1 }).removeBackground(photo)
      expect(out.png.equals(cutout)).toBe(true)
      expect(calls).toHaveLength(2)
      // Same deadline for both attempts, not a fresh one.
      expect(calls[1].init?.signal).toBe(calls[0].init?.signal)
    })

    it("retries once after a dropped connection", async () => {
      let n = 0
      const { fn, calls } = fakeFetch(() => {
        if (++n === 1) throw new TypeError("fetch failed")
        return answer()
      })
      await expect(
        new FalProvider({ apiKey: KEY, fetch: fn, retryPauseMs: 1 }).removeBackground(photo)
      ).resolves.toMatchObject({ model: "birefnet-general" })
      expect(calls).toHaveLength(2)
    })

    it("gives up after the second failure", async () => {
      const { fn, calls } = fakeFetch(() => json({ detail: "still cold" }, 503))
      await expect(
        new FalProvider({ apiKey: KEY, fetch: fn, retryPauseMs: 1 }).removeBackground(photo)
      ).rejects.toThrow("The photo service failed (HTTP 503): still cold")
      expect(calls).toHaveLength(2)
    })

    it("does not retry a timeout, a 500, a 422, a 429 or a refused account", async () => {
      const once = async (res: () => Response) => {
        const { fn, calls } = fakeFetch(res)
        await new FalProvider({ apiKey: KEY, fetch: fn, retryPauseMs: 1 }).removeBackground(photo).catch(() => {})
        return calls.length
      }
      expect(
        await once(() => {
          const e = new Error("timeout")
          e.name = "TimeoutError"
          throw e
        })
      ).toBe(1)
      expect(await once(() => json({ detail: "boom" }, 500))).toBe(1)
      expect(await once(() => json({ detail: "bad enum" }, 422))).toBe(1)
      expect(await once(() => json({ detail: "slow down" }, 429))).toBe(1)
      expect(await once(() => json({ detail: "no" }, 401))).toBe(1)
    })

    it("does not retry once the deadline has passed", async () => {
      const { fn, calls } = fakeFetch(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60))
        return json({ detail: "late" }, 503)
      })
      await expect(
        new FalProvider({ apiKey: KEY, fetch: fn, timeoutMs: 30, retryPauseMs: 1 }).removeBackground(photo)
      ).rejects.toThrow(/timed out|HTTP 503/)
      expect(calls).toHaveLength(1)
    })
  })

  it("refuses an inline answer over the size cap without decoding it", async () => {
    expect(MAX_RESULT_BYTES).toBe(25 * 1024 * 1024)
    const tooBig = "data:image/png;base64," + "A".repeat(Math.ceil((MAX_RESULT_BYTES * 4) / 3) + 4)
    const { fn } = fakeFetch(() => json({ image: { url: tooBig } }))
    const from = jest.spyOn(Buffer, "from")
    try {
      await expect(new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(photo)).rejects.toThrow(
        "The photo service returned an image that is too large"
      )
      expect(from.mock.calls.some(([v]) => typeof v === "string" && v.length > 1_000_000)).toBe(false)
    } finally {
      from.mockRestore()
    }
  })

  it("refuses a download whose declared size is over the cap before reading it", async () => {
    const { fn } = fakeFetch((url) =>
      url === FAL_BIREFNET_URL
        ? json({ image: { url: "https://v3.fal.media/files/out.png" } })
        : new Response("x", { status: 200, headers: { "content-length": String(MAX_RESULT_BYTES + 1) } })
    )
    await expect(new FalProvider({ apiKey: KEY, fetch: fn }).removeBackground(photo)).rejects.toThrow(
      "too large"
    )
  })

  it("reports an unreachable and a timed-out service", async () => {
    const down = new FalProvider({
      apiKey: KEY,
      fetch: fakeFetch(() => {
        throw new TypeError("fetch failed")
      }).fn,
    })
    await expect(down.removeBackground(photo)).rejects.toThrow("The photo service is unreachable")

    const slow = new FalProvider({
      apiKey: KEY,
      timeoutMs: 5_000,
      fetch: fakeFetch(() => {
        const e = new Error("timeout")
        e.name = "TimeoutError"
        throw e
      }).fn,
    })
    await expect(slow.removeBackground(photo)).rejects.toThrow("timed out after 5 s")
  })
})
