import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { BUSINESS_TYPES } from "../../../modules/trade/constants"

/** Upper-cases and strips spaces; "" and null become null. */
const normalisedId = (pattern: RegExp, message: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.replace(/\s+/g, "").toUpperCase() || null
        : value,
    z.string().regex(pattern, message).nullable().optional()
  )

export const PHONE_PATTERN = /^[0-9+()\- ]{5,40}$/

export const StoreSubmitTradeApplication = z.strictObject({
  company_name: z.string().trim().min(1).max(200),
  vat_number: normalisedId(/^(GB)?(\d{9}|\d{12})$/, "Enter a valid UK VAT number"),
  companies_house_number: normalisedId(
    /^[A-Z0-9]{8}$/,
    "Enter a valid Companies House number (8 characters)"
  ),
  business_type: z.enum(BUSINESS_TYPES),
  contact: z.strictObject({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
    email: z.email().max(320),
  }),
})
export type StoreSubmitTradeApplication = z.infer<typeof StoreSubmitTradeApplication>

export const storeTradeMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/trade-applications*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST"],
    matcher: "/store/trade-applications",
    middlewares: [validateAndTransformBody(StoreSubmitTradeApplication)],
  },
  {
    method: ["GET"],
    matcher: "/store/products/:id/trade-tiers",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
