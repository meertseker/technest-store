import http from "http"
import { AddressInfo } from "net"
import { s3FileProviderOptions } from "../file-storage"

const S3FileService = require("@medusajs/medusa/file-s3").default.services[0]

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders }

/** A stand-in S3 endpoint that records what the provider sends. */
async function startBucket() {
  const seen: Seen[] = []
  const server = http.createServer((req, res) => {
    req.resume()
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers })
      if (req.method === "POST") {
        res.writeHead(200, { "content-type": "application/xml" })
        return res.end('<?xml version="1.0" encoding="UTF-8"?><DeleteResult></DeleteResult>')
      }
      res.writeHead(200, { etag: '"abc"' })
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return {
    seen,
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

describe("s3FileProviderOptions", () => {
  const env = {
    S3_FILE_URL: "https://media.example.test",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_BUCKET: "bucket",
    S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  }

  it("maps the environment and defaults the region to auto", () => {
    expect(s3FileProviderOptions(env)).toMatchObject({
      file_url: "https://media.example.test",
      access_key_id: "key",
      secret_access_key: "secret",
      bucket: "bucket",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
    })
    expect(s3FileProviderOptions({ ...env, S3_REGION: "weur" }).region).toBe("weur")
  })

  it("makes the installed S3 provider upload without an ACL header or an optional checksum", async () => {
    const bucket = await startBucket()
    try {
      const service = new S3FileService(
        { logger: { error: jest.fn() } },
        s3FileProviderOptions({ ...env, S3_ENDPOINT: bucket.endpoint })
      )
      for (const access of ["public", "private", undefined]) {
        await service.upload({
          filename: "photo.webp",
          mimeType: "image/webp",
          content: Buffer.from("not really a photo").toString("base64"),
          access,
        })
      }
      const puts = bucket.seen.filter((r) => r.method === "PUT")
      expect(puts).toHaveLength(3)
      for (const put of puts) {
        expect(put.headers["x-amz-acl"]).toBeUndefined()
        expect(put.headers["x-amz-checksum-crc32"]).toBeUndefined()
        expect(put.headers["x-amz-sdk-checksum-algorithm"]).toBeUndefined()
        expect(put.headers["content-type"]).toBe("image/webp")
      }

      // Deleting several files is one request; the S3 API requires a checksum on it.
      await service.delete([{ fileKey: "a.webp" }, { fileKey: "b.webp" }])
      const bulkDelete = bucket.seen.find((r) => r.method === "POST")
      expect(bulkDelete?.url).toContain("delete")
      expect(bulkDelete?.headers["x-amz-checksum-crc32"] ?? bulkDelete?.headers["content-md5"]).toBeDefined()
    } finally {
      await bucket.close()
    }
  })
})
