import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { adminClickCollectMiddlewares } from './admin/click-collect/middlewares'
import { adminDeliveryOrdersMiddlewares } from './admin/delivery-orders/middlewares'
import { adminShopDashboardMiddlewares } from './admin/shop-dashboard/middlewares'
import { adminDeviceMiddlewares } from './admin/devices/middlewares'
import { adminProductAttributesMiddlewares } from './admin/products/[id]/attributes/middlewares'
import { adminVariantPriceStockMiddlewares } from './admin/products/[id]/variants/middlewares'
import { adminPhotoMiddlewares } from './admin/photos/middlewares'
import { adminUploadMiddlewares } from './admin/uploads/middlewares'
import { adminProductImportMiddlewares } from './admin/product-import/middlewares'
import { adminTechnestSettingsMiddlewares } from './admin/technest-settings/middlewares'
import { verifyStripeWebhookSignature } from './hooks/payment/verify-stripe-signature'
import { verifyResendWebhookSignature } from './hooks/email/verify-resend-signature'
import { adminQuickAddMiddlewares } from './admin/quick-add/middlewares'
import { rejectClientPaymentData } from './store/payment-collections/reject-client-payment-data'
import { storeCartMiddlewares } from './store/carts/middlewares'
import { storeDeviceMiddlewares } from './store/devices/middlewares'
import { sentryErrorHandler } from '../lib/monitoring/sentry-error-handler'
import { storeProductMiddlewares } from './store/products/middlewares'
import { adminRepairMiddlewares } from './admin/repair-bookings/middlewares'
import { adminTradeMiddlewares } from './admin/trade-applications/middlewares'
import { storeRepairMiddlewares } from './store/repair-bookings/middlewares'
import { storeTradeMiddlewares } from './store/trade-applications/middlewares'
import { authThrottleMiddlewares } from '../lib/auth-throttle'
import { servePanel } from '../lib/panel/serve'

export default defineMiddlewares({
  // E4: Medusa's default error handler + report 5xx to Sentry (no-op without SENTRY_DSN).
  errorHandler: sentryErrorHandler,
  routes: [
    // The shop panel's built files (lib/panel/serve.ts). Caddy exposes /panel on the admin host only.
    { matcher: '/panel', middlewares: [servePanel] },
    // Sign-in, registration, password reset and trade applications are counted per
    // visitor IP and per email; over the limit the answer is 429 (lib/auth-throttle.ts).
    ...authThrottleMiddlewares,
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
    {
      // E2: Resend tells us here when an email bounced or was marked as spam. The
      // signature is over the raw body (same reason as the Stripe hook above).
      method: ['POST'],
      matcher: '/hooks/email/resend',
      bodyParser: { preserveRawBody: true },
      middlewares: [verifyResendWebhookSignature],
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
    ...storeCartMiddlewares,
    ...storeProductMiddlewares,
    ...storeDeviceMiddlewares,
    ...adminDeviceMiddlewares,
    ...adminProductAttributesMiddlewares,
    ...adminVariantPriceStockMiddlewares,
    ...storeTradeMiddlewares,
    ...adminTradeMiddlewares,
    ...storeRepairMiddlewares,
    ...adminRepairMiddlewares,
    ...adminPhotoMiddlewares,
    ...adminUploadMiddlewares,
    ...adminProductImportMiddlewares,
    ...adminClickCollectMiddlewares,
    ...adminDeliveryOrdersMiddlewares,
    ...adminShopDashboardMiddlewares,
    ...adminTechnestSettingsMiddlewares,
    ...adminQuickAddMiddlewares,
  ],
})
