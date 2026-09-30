import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

/** About 2000 rows of a stock list fit well under this. */
export const MAX_CSV_CHARS = 2_000_000

export const AdminProductImport = z.strictObject({
  csv: z
    .string()
    .min(1, "The file is empty.")
    .max(MAX_CSV_CHARS, "The file is too big. Split it into smaller files."),
})
export type AdminProductImport = z.infer<typeof AdminProductImport>

const body = {
  method: ["POST"] as ["POST"],
  bodyParser: { sizeLimit: "5mb" },
  middlewares: [validateAndTransformBody(AdminProductImport)],
}

export const adminProductImportMiddlewares: MiddlewareRoute[] = [
  { matcher: "/admin/product-import", ...body },
  { matcher: "/admin/product-import/preview", ...body },
]
