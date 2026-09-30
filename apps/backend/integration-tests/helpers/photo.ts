import http from "http"
import { AddressInfo } from "net"
import sharp from "sharp"

export const BACKDROP = { r: 226, g: 222, b: 212 }
export const PRODUCT_COLOUR = { r: 30, g: 60, b: 170 }

/** A phone-style photo: warm grey backdrop, a blue product rectangle in the middle. */
export async function makePhoto(width: number, height: number) {
  const pw = Math.round(width * 0.4)
  const ph = Math.round(height * 0.35)
  return sharp({ create: { width, height, channels: 3, background: BACKDROP } })
    .composite([
      {
        input: { create: { width: pw, height: ph, channels: 3, background: PRODUCT_COLOUR } },
        left: Math.round((width - pw) / 2),
        top: Math.round((height - ph) / 2),
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()
}

/** Stand-in for rembg: alpha 255 where a pixel differs clearly from the backdrop. */
async function fakeCutout(image: Buffer) {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let p = 0; p < info.width * info.height; p++) {
    const [r, g, b] = [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]]
    const diff = Math.abs(r - BACKDROP.r) + Math.abs(g - BACKDROP.g) + Math.abs(b - BACKDROP.b)
    out[p * 4] = r
    out[p * 4 + 1] = g
    out[p * 4 + 2] = b
    out[p * 4 + 3] = diff > 60 ? 255 : 0
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

export type MockWorker = {
  url: string
  requests: { model: string | null; bytes: number }[]
  /** Next /remove calls fail with this HTTP status. */
  failWith: number | null
  close: () => Promise<void>
}

/** An HTTP server speaking the photo-worker contract (infra/photo-worker/README.md). */
export async function startMockWorker(port = 0): Promise<MockWorker> {
  const state: MockWorker = { url: "", requests: [], failWith: null, close: async () => {} }

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify({ status: "ok" }))
    }
    if (req.method === "POST" && req.url === "/remove") {
      const chunks: Buffer[] = []
      for await (const c of req) {
        chunks.push(c as Buffer)
      }
      const form = await new Request("http://mock/remove", {
        method: "POST",
        headers: { "content-type": req.headers["content-type"] ?? "" },
        body: Buffer.concat(chunks),
      }).formData()
      const file = form.get("file") as Blob
      const image = Buffer.from(await file.arrayBuffer())
      state.requests.push({ model: form.get("model") as string | null, bytes: image.length })
      if (state.failWith) {
        res.writeHead(state.failWith)
        return res.end("worker exploded")
      }
      const png = await fakeCutout(image)
      res.writeHead(200, { "content-type": "image/png" })
      return res.end(png)
    }
    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve))
  state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  state.close = () => new Promise((resolve) => server.close(() => resolve()))
  return state
}
