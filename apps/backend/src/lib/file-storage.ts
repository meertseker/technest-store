type S3Env = Record<string, string | undefined>

/**
 * Options for Medusa's S3 file provider, set up for Cloudflare R2:
 *  - `acl: false`: R2 has no object ACLs, so no `x-amz-acl` header is sent.
 *    Whether a file is public is decided by the bucket's public domain.
 *  - checksums only where the S3 API requires one. The AWS SDK otherwise adds
 *    a CRC32 checksum to every upload and validates one on every download,
 *    which S3-compatible stores do not all accept.
 */
export function s3FileProviderOptions(env: S3Env) {
  return {
    file_url: env.S3_FILE_URL,
    access_key_id: env.S3_ACCESS_KEY_ID,
    secret_access_key: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION || "auto",
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT,
    acl: false as const,
    additional_client_config: {
      requestChecksumCalculation: "WHEN_REQUIRED" as const,
      responseChecksumValidation: "WHEN_REQUIRED" as const,
    },
  }
}
