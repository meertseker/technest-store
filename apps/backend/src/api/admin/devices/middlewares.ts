import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DEVICE_SLUG_PATTERN, DEVICE_TYPES } from "../../../modules/device/utils"

const slug = z
  .string()
  .regex(DEVICE_SLUG_PATTERN, "Slug must be lowercase kebab-case")

const deviceFields = {
  brand: z.string().trim().min(1),
  series: z.string().trim().min(1),
  model: z.string().trim().min(1),
  type: z.enum(DEVICE_TYPES),
  slug: slug.optional(),
  aliases: z.array(z.string().trim().min(1)).optional(),
  release_year: z.number().int().min(1990).max(2100).nullable().optional(),
  image_url: z.url().nullable().optional(),
}

export const AdminCreateDevice = z.strictObject(deviceFields)
export type AdminCreateDevice = z.infer<typeof AdminCreateDevice>

export const AdminUpdateDevice = z.strictObject({
  brand: deviceFields.brand.optional(),
  series: deviceFields.series.optional(),
  model: deviceFields.model.optional(),
  type: deviceFields.type.optional(),
  slug: deviceFields.slug,
  aliases: deviceFields.aliases,
  release_year: deviceFields.release_year,
  image_url: deviceFields.image_url,
})
export type AdminUpdateDevice = z.infer<typeof AdminUpdateDevice>

const toArray = (value: unknown) =>
  value === undefined || Array.isArray(value) ? value : [value]
const toInt = (value: unknown) =>
  typeof value === "string" ? parseInt(value, 10) : value

export const DEVICE_ORDER_FIELDS = ["model", "brand", "release_year", "created_at"] as const
type DeviceOrderField = (typeof DEVICE_ORDER_FIELDS)[number]
const ORDER_VALUES = DEVICE_ORDER_FIELDS.flatMap((f) => [f, `-${f}`]) as [
  DeviceOrderField | `-${DeviceOrderField}`,
  ...(DeviceOrderField | `-${DeviceOrderField}`)[],
]

export const AdminGetDevicesParams = z.strictObject({
  q: z.string().optional(),
  type: z.preprocess(toArray, z.array(z.enum(DEVICE_TYPES)).optional()),
  brand: z.preprocess(toArray, z.array(z.string()).optional()),
  limit: z.preprocess(toInt, z.number().int().min(1).max(200).default(50)),
  offset: z.preprocess(toInt, z.number().int().min(0).default(0)),
  order: z.enum(ORDER_VALUES).optional(),
})
export type AdminGetDevicesParams = z.infer<typeof AdminGetDevicesParams>

export const AdminSetProductDevices = z.strictObject({
  add: z
    .array(
      z.strictObject({
        device_id: z.string().min(1),
        note: z.string().trim().max(200).nullable().optional(),
      })
    )
    .optional(),
  remove: z.array(z.string().min(1)).optional(),
})
export type AdminSetProductDevices = z.infer<typeof AdminSetProductDevices>

export const adminDeviceMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/devices",
    middlewares: [validateAndTransformQuery(AdminGetDevicesParams, {})],
  },
  {
    method: ["POST"],
    matcher: "/admin/devices",
    middlewares: [validateAndTransformBody(AdminCreateDevice)],
  },
  {
    method: ["POST"],
    matcher: "/admin/devices/:id",
    middlewares: [validateAndTransformBody(AdminUpdateDevice)],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/devices",
    middlewares: [validateAndTransformBody(AdminSetProductDevices)],
  },
]
