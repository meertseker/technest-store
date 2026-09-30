import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { importProductsWorkflow } from "../../../workflows/import-products"
import { AdminProductImport } from "./middlewares"

/**
 * POST /admin/product-import: imports the CSV (upsert by SKU). Rows with
 * errors are skipped and reported; a file-level error imports nothing.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminProductImport>,
  res: MedusaResponse
) {
  const { result } = await importProductsWorkflow(req.scope).run({
    input: { csv: req.validatedBody.csv },
  })
  if (result.plan.file_errors.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, result.plan.file_errors.join(" "))
  }
  res.json(result)
}
