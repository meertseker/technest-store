import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { technestImportProductsWorkflow } from "../../../workflows/technest-import-products"
import { AdminProductImport } from "./middlewares"

/**
 * POST /admin/product-import: imports the CSV (upsert by SKU). The plan is
 * rebuilt here, never taken from the client. Rows with errors are skipped and
 * reported; a file-level error imports nothing (400 invalid_data).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminProductImport>,
  res: MedusaResponse
) {
  const { result } = await technestImportProductsWorkflow(req.scope).run({
    input: { csv: req.validatedBody.csv },
  })
  res.json(result)
}
