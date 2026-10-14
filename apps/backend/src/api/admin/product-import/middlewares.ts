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

/**
 * The commit also takes `part` (0-based): write only that part of the file
 * (200 data rows), so each request stays well inside the proxy's time limit.
 */
export const AdminProductImportCommit = z.strictObject({
  csv: AdminProductImport.shape.csv,
  part: z.number().int().min(0).max(100).optional(),
})
export type AdminProductImportCommit = z.infer<typeof AdminProductImportCommit>

const body = {
  method: ["POST"] as ["POST"],
  bodyParser: { sizeLimit: "5mb" },
}

export const adminProductImportMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/product-import",
    ...body,
    middlewares: [validateAndTransformBody(AdminProductImportCommit)],
  },
  {
    matcher: "/admin/product-import/preview",
    ...body,
    middlewares: [validateAndTransformBody(AdminProductImport)],
  },
]
