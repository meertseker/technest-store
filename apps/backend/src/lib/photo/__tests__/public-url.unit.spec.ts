import { publicFileUrl } from "../public-url"

// What Medusa's S3 provider answers for retrieveFile(id).url: a signed GetObject URL that expires.
const PRESIGNED =
  "https://account.r2.cloudflarestorage.com/technest-media/case-01JABC.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=abc"

const r2 = { S3_BUCKET: "technest-media", S3_FILE_URL: "https://media.technest.co.uk" }

describe("publicFileUrl", () => {
  it("on R2 gives the media-domain URL the upload returned, never the signed one", () => {
    const url = publicFileUrl({ id: "case-01JABC.webp", url: PRESIGNED }, r2)

    expect(url).toBe("https://media.technest.co.uk/case-01JABC.webp")
    expect(url).not.toMatch(/X-Amz|r2\.cloudflarestorage/)
  })

  it("encodes each part of the key as the S3 provider does on upload", () => {
    expect(publicFileUrl({ id: "photos/blue case #2-01JABC.webp", url: PRESIGNED }, r2)).toBe(
      "https://media.technest.co.uk/photos/blue%20case%20%232-01JABC.webp"
    )
  })

  it("doesn't double the slash when S3_FILE_URL ends with one", () => {
    expect(
      publicFileUrl({ id: "case-01JABC.webp", url: PRESIGNED }, { ...r2, S3_FILE_URL: "https://media.technest.co.uk/" })
    ).toBe("https://media.technest.co.uk/case-01JABC.webp")
  })

  it("with the local provider keeps the URL as it is (already public)", () => {
    const local = "http://localhost:9000/static/case-01JABC.webp"

    expect(publicFileUrl({ id: "case-01JABC.webp", url: local }, {})).toBe(local)
  })
})
