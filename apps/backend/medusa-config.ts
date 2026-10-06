import path from "path"
import { loadEnv, defineConfig, MedusaError } from "@medusajs/framework/utils"
import { missingProductionEnv } from "./src/lib/production-env"
import { s3FileProviderOptions } from "./src/lib/file-storage"

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
          // The default is one attempt: a subscriber that throws (a held order
          // lock) would never run again for that event. Only subscribers that
          // throw are retried; the email subscribers catch their own errors.
          options: {
            redisUrl,
            jobOptions: { attempts: 4, backoff: { type: "exponential", delay: 5000 } },
          },
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
            options: s3FileProviderOptions(process.env),
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

// Payments (E2): our subclass of Medusa's Stripe provider (see
// docs/adr/0002-stripe-payment-params.md). Still pp_stripe_stripe; webhook at
// /hooks/payment/stripe_stripe. Authorise only (capture: false): delivery
// orders are captured after order.placed, Click & Collect on "Collected".
// Without STRIPE_API_KEY (dev/test) the module is left out so the app boots;
// production refuses to start without the settings in lib/production-env.ts
// (Stripe key, webhook secret, Redis).
const missing = missingProductionEnv(process.env)
if (missing.length) {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, `${missing.join(", ")} required in production`)
}
const paymentProviders = [
  ...(process.env.STRIPE_API_KEY
    ? [
        {
          resolve: "./src/modules/stripe",
          id: "stripe",
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            capture: false,
            // Option name per @medusajs/payment-stripe 2.21 source
            // (the docs' "automatic_payment_methods" is not read).
            automaticPaymentMethods: true,
            paymentDescription: "Tech Nest order",
            klarnaMinBasketPence: process.env.KLARNA_MIN_BASKET_PENCE || 3000,
          },
        },
      ]
    : []),
  // Integration tests only: a Stripe stand-in that records authorize/capture/
  // cancel/refund calls (pp_recording_test). Never in production. Absolute
  // path: Medusa rewrites "./x" provider paths to "./src/x".
  ...(!isProduction && process.env.TECHNEST_TEST_PAYMENT_PROVIDER === "true"
    ? [
        {
          resolve: path.join(process.cwd(), "integration-tests/helpers/recording-payment-provider"),
          id: "test",
        },
      ]
    : []),
]
const paymentModules = paymentProviders.length
  ? [{ resolve: "@medusajs/medusa/payment", options: { providers: paymentProviders } }]
  : []

// Email (E2): our own SMTP provider. Dev/test default to Mailpit on
// localhost:1025; production must set SMTP_HOST, MAIL_FROM and the login explicitly
// (validateOptions fails the boot otherwise).
const notificationModule = {
  resolve: "@medusajs/medusa/notification",
  options: {
    providers: [
      {
        resolve: "./src/modules/smtp",
        id: "smtp",
        options: {
          channels: ["email"],
          host: process.env.SMTP_HOST || (isProduction ? undefined : "localhost"),
          port: process.env.SMTP_PORT || (isProduction ? undefined : "1025"),
          secure: process.env.SMTP_SECURE === "true",
          // Production refuses to send (or authenticate) without TLS.
          require_tls: process.env.SMTP_REQUIRE_TLS
            ? process.env.SMTP_REQUIRE_TLS === "true"
            : isProduction,
          user: process.env.SMTP_USER || undefined,
          pass: process.env.SMTP_PASS || undefined,
          from:
            process.env.MAIL_FROM ||
            (isProduction ? undefined : "Tech Nest <hello@technest.co.uk>"),
          reply_to: process.env.MAIL_REPLY_TO || undefined,
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
    { resolve: "./src/modules/device" },
    { resolve: "./src/modules/product-attributes" },
    { resolve: "./src/modules/trade" },
    { resolve: "./src/modules/repair" },
    // Photos (E4): FAL_KEY = background removal on fal.ai (production). PHOTO_WORKER_URL = our own
    // photo-worker instead (local use, tests; PHOTO_MODEL picks its model). Neither = processing disabled.
    {
      resolve: "./src/modules/photo",
      options: {
        falKey: process.env.FAL_KEY,
        workerUrl: process.env.PHOTO_WORKER_URL,
        defaultModel: process.env.PHOTO_MODEL,
      },
    },
    { resolve: "./src/modules/settings" },
    fileModule,
    ...redisModules,
    ...paymentModules,
    notificationModule,
  ],
})
