type FileEnv = { S3_BUCKET?: string; S3_FILE_URL?: string }

/**
 * The URL to save on a product for a stored file.
 *
 * Medusa's `retrieveFile(id).url` is the provider's presigned download URL. On
 * R2 that is a signed link to the storage endpoint that expires within the
 * hour, so it must never be saved or shown to shoppers. With S3_BUCKET set
 * (medusa-config.ts) the public URL is rebuilt the way the S3 provider builds
 * it on upload: S3_FILE_URL plus the file key, which is the file's id. The
 * local provider's URL is already the public one.
 */
export function publicFileUrl(
  file: { id: string; url: string },
  env: FileEnv = process.env
): string {
  if (!env.S3_BUCKET) return file.url
  const encodedKey = file.id.split("/").map(encodeURIComponent).join("/")
  return `${(env.S3_FILE_URL ?? "").replace(/\/+$/, "")}/${encodedKey}`
}
