import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { adminClickCollectMiddlewares } from './admin/click-collect/middlewares'
import { adminDeviceMiddlewares } from './admin/devices/middlewares'
import { adminProductAttributesMiddlewares } from './admin/products/[id]/attributes/middlewares'
import { adminPhotoMiddlewares } from './admin/photos/middlewares'
import { adminProductImportMiddlewares } from './admin/product-import/middlewares'
import { adminTechnestSettingsMiddlewares } from './admin/technest-settings/middlewares'
import { verifyStripeWebhookSignature } from './hooks/payment/verify-stripe-signature'
import { adminQuickAddMiddlewares } from './admin/quick-add/middlewares'
import { rejectClientPaymentData } from './store/payment-collections/reject-client-payment-data'
import { storeDeviceMiddlewares } from './store/devices/middlewares'
import { sentryErrorHandler } from '../lib/monitoring/sentry-error-handler'
import { storeProductMiddlewares } from './store/products/middlewares'
import { adminRepairMiddlewares } from './admin/repair-bookings/middlewares'
import { adminTradeMiddlewares } from './admin/trade-applications/middlewares'
import { storeRepairMiddlewares } from './store/repair-bookings/middlewares'
import { storeTradeMiddlewares } from './store/trade-applications/middlewares'

export default defineMiddlewares({
  // E4: Medusa's default error handler + report 5xx to Sentry (no-op without SENTRY_DSN).
  errorHandler: sentryErrorHandler,
  routes: [
    {
      // E2 / ADR 0002: payment session data is server-side only.
      method: ['POST'],
      matcher: '/store/payment-collections/:id/payment-sessions',
      middlewares: [rejectClientPaymentData],
    },
    {
      // E2: Stripe webhooks must carry a valid signature over the raw body
      // (Medusa's core hooks middleware preserves it for this path).
      method: ['POST'],
      matcher: '/hooks/payment/stripe_stripe',
      bodyParser: { preserveRawBody: true },
      middlewares: [verifyStripeWebhookSignature],
    },
    // The product index declares filterable `status` and `sales_channel_ids`, so
    // the route narrows it to published products in the key's sales channels.
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    ...storeProductMiddlewares,
    ...storeDeviceMiddlewares,
    ...adminDeviceMiddlewares,
    ...adminProductAttributesMiddlewares,
    ...storeTradeMiddlewares,
    ...adminTradeMiddlewares,
    ...storeRepairMiddlewares,
    ...adminRepairMiddlewares,
    ...adminPhotoMiddlewares,
    ...adminProductImportMiddlewares,
    ...adminClickCollectMiddlewares,
    ...adminTechnestSettingsMiddlewares,
    ...adminQuickAddMiddlewares,
  ],
})
