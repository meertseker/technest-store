import {
  applyDefaultFilters,
  authenticate,
  clearFiltersByKey,
  maybeApplyLinkFilter,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  isPresent,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  filterByValidSalesChannels,
  normalizeDataForContext,
  setPricingContext,
  setTaxContext,
} from "@medusajs/medusa/api/utils/middlewares/index"
import { listProductQueryConfig } from "@medusajs/medusa/api/store/products/query-config"
import { StoreGetProductsParams } from "@medusajs/medusa/api/store/products/validators"
import ProductDeviceLink from "../../../links/product-device"
import { DEVICE_TYPES } from "../../../modules/device/utils"

const typeList = z.preprocess(
  (value) => (value === undefined || Array.isArray(value) ? value : [value]),
  z.array(z.enum(DEVICE_TYPES)).optional()
)

export const StoreGetDevicesParams = z.strictObject({
  q: z.string().optional(),
  type: typeList,
})
export type StoreGetDevicesParams = z.infer<typeof StoreGetDevicesParams>

/** Default and largest page sizes for the device product listing. */
export const DEVICE_PRODUCTS_DEFAULT_LIMIT = 24
export const DEVICE_PRODUCTS_MAX_LIMIT = 100

/** Where the device product listing keeps link notes for the route handler. */
export type DeviceProductsRequest = MedusaRequest & {
  deviceProductNotes?: Record<string, string>
}

/**
 * Narrows the core product listing to products linked to `:slug`. Runs right
 * after the core query validation so the core sales-channel filter intersects
 * with (rather than replaces) the id filter.
 */
async function applyDeviceProductFilter(
  req: DeviceProductsRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: devices } = await query.graph({
    entity: "device",
    fields: ["id"],
    filters: { slug: req.params.slug },
  })
  if (!devices.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Device ${req.params.slug} was not found`
    )
  }

  const { data: links } = await query.graph({
    entity: ProductDeviceLink.entryPoint,
    fields: ["product_id", "note"],
    filters: { device_id: devices[0].id },
  })

  const productIds = links.map((l) => l.product_id as string)
  // An empty id list would mean "no filter"; an unmatchable id keeps the
  // response shape while returning nothing.
  req.filterableFields.id = productIds.length ? productIds : ["prod_none"]
  req.deviceProductNotes = Object.fromEntries(
    links
      .filter((l) => isPresent(l.note))
      .map((l) => [l.product_id as string, l.note as string])
  )

  // The core validator always fills in limit=50, so apply our default of 24
  // when the client sent none, and cap explicit limits.
  const pagination = req.queryConfig.pagination
  if (pagination) {
    if (req.query.limit === undefined) {
      pagination.take = DEVICE_PRODUCTS_DEFAULT_LIMIT
    } else if ((pagination.take ?? 0) > DEVICE_PRODUCTS_MAX_LIMIT) {
      pagination.take = DEVICE_PRODUCTS_MAX_LIMIT
    }
  }
  next()
}

export const storeDeviceMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/devices",
    middlewares: [validateAndTransformQuery(StoreGetDevicesParams, {})],
  },
  {
    // Mirrors the core GET /store/products stack (@medusajs/medusa 2.21) so the
    // response is identical; covered by integration-tests/http/devices.spec.ts.
    method: ["GET"],
    matcher: "/store/devices/:slug/products",
    middlewares: [
      authenticate("customer", ["session", "bearer"], {
        allowUnauthenticated: true,
      }),
      validateAndTransformQuery(StoreGetProductsParams, listProductQueryConfig),
      applyDeviceProductFilter,
      filterByValidSalesChannels(),
      maybeApplyLinkFilter({
        entryPoint: "product_sales_channel",
        resourceId: "product_id",
        filterableField: "sales_channel_id",
      }),
      applyDefaultFilters({
        status: ProductStatus.PUBLISHED,
        categories: (filters: Record<string, unknown>) => {
          const categoryIds = filters.category_id
          delete filters.category_id
          if (!isPresent(categoryIds)) {
            return
          }
          return { id: categoryIds, is_internal: false, is_active: true }
        },
      }),
      normalizeDataForContext(),
      setPricingContext(),
      setTaxContext(),
      clearFiltersByKey(["region_id", "country_code", "province", "cart_id"]),
    ],
  },
]
