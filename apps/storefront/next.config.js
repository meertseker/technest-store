const path = require("path")
const checkEnvVariables = require("./check-env-variables")
const { securityHeaders } = require("./security-headers")

checkEnvVariables()

const BACKEND_URL = new URL(
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
)
// Public host of product images (R2 / CDN), from E1's .env.template
const IMAGE_HOST = process.env.NEXT_PUBLIC_IMAGE_HOSTNAME
// Medusa's demo seed images; dev only, real product images come from the backend or R2
const DEMO_IMAGE_HOST = "medusa-public-images.s3.eu-west-1.amazonaws.com"
const IS_PROD = process.env.NODE_ENV === "production"
// A stray C:\Users\meert\package-lock.json makes Next pick the wrong workspace root
const MONOREPO_ROOT = path.join(__dirname, "../..")

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: MONOREPO_ROOT },
  outputFileTracingRoot: MONOREPO_ROOT,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: BACKEND_URL.protocol.replace(":", ""),
        hostname: BACKEND_URL.hostname,
        port: BACKEND_URL.port,
      },
      ...(IMAGE_HOST ? [{ protocol: "https", hostname: IMAGE_HOST }] : []),
      ...(IS_PROD ? [] : [{ protocol: "https", hostname: DEMO_IMAGE_HOST }]),
    ],
  },
  async headers() {
    // The /checkout CSP is per-request (nonce) and set in src/middleware.ts (E2).
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

module.exports = nextConfig
