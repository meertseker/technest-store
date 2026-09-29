import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const isProduction = process.env.NODE_ENV === "production"
const redisUrl = process.env.REDIS_URL
const useS3 = !!process.env.S3_BUCKET

// Production runs a server + worker pair sharing Redis. Dev uses Medusa's
// in-memory defaults so the four engineers never share queues or locks.
const redisModules =
  isProduction && redisUrl
    ? [
        {
          resolve: "@medusajs/medusa/event-bus-redis",
          options: { redisUrl },
        },
        {
          resolve: "@medusajs/medusa/workflow-engine-redis",
          options: { redis: { redisUrl } },
        },
        {
          resolve: "@medusajs/medusa/locking",
          options: {
            providers: [
              {
                resolve: "@medusajs/medusa/locking-redis",
                id: "locking-redis",
                is_default: true,
                options: { redisUrl },
              },
            ],
          },
        },
      ]
    : []

// Cloudflare R2 through the S3 provider when S3_BUCKET is set, else local disk.
const fileModule = {
  resolve: "@medusajs/medusa/file",
  options: {
    providers: [
      useS3
        ? {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION || "auto",
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
            },
          }
        : {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              backend_url: `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static`,
            },
          },
    ],
  },
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: isProduction ? redisUrl : undefined,
    workerMode: process.env.MEDUSA_WORKER_MODE as
      | "shared"
      | "worker"
      | "server"
      | undefined,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
  modules: [
    fileModule,
    ...redisModules,
    // Payments (Stripe) are configured here by E2.
    // Notifications (smtp provider) are configured here by E2.
  ],
})
