import { loadEnv, defineConfig, MedusaError } from "@medusajs/framework/utils"

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

// Payments (E2): our subclass of Medusa's Stripe provider (see
// docs/adr/0002-stripe-payment-params.md). Still pp_stripe_stripe; webhook at
// /hooks/payment/stripe_stripe. Authorise only (capture: false): delivery
// orders are captured after order.placed, Click & Collect on "Collected".
// Without STRIPE_API_KEY (dev/test) the module is left out so the app boots;
// production refuses to start without the key and the webhook secret.
// Without the webhook secret every Stripe webhook fails verification and
// 3DS/Klarna orders stay pending after the shopper has paid.
for (const name of ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET"]) {
  if (isProduction && !process.env[name]) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${name} is required in production`)
  }
}
const paymentModules = process.env.STRIPE_API_KEY
  ? [
      {
        resolve: "@medusajs/medusa/payment",
        options: {
          providers: [
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
          ],
        },
      },
    ]
  : []

// Email (E2): our own SMTP provider. Dev/test default to Mailpit on
// localhost:1025; production must set SMTP_HOST and MAIL_FROM explicitly
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
    fileModule,
    ...redisModules,
    ...paymentModules,
    notificationModule,
  ],
})
