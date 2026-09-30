import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { adminClickCollectMiddlewares } from './admin/click-collect/middlewares'
import { adminDeviceMiddlewares } from './admin/devices/middlewares'
import { rejectClientPaymentData } from './store/payment-collections/reject-client-payment-data'
import { storeDeviceMiddlewares } from './store/devices/middlewares'

export default defineMiddlewares({
  routes: [
    {
      // E2 / ADR 0002: payment session data is server-side only.
      method: ['POST'],
      matcher: '/store/payment-collections/:id/payment-sessions',
      middlewares: [rejectClientPaymentData],
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
    ...storeDeviceMiddlewares,
    ...adminDeviceMiddlewares,
    ...adminClickCollectMiddlewares,
  ],
})
