import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { clientIp } from "../../../lib/rate-limit"
import { createRepairBookingWorkflow } from "../../../workflows/create-repair-booking"
import { StoreCreateRepairBooking } from "./middlewares"

export async function POST(
  req: MedusaRequest<StoreCreateRepairBooking>,
  res: MedusaResponse
) {
  // Turnstile is verified inside the workflow (first step), before anything is stored.
  const { result } = await createRepairBookingWorkflow(req.scope).run({
    input: { ...req.validatedBody, remote_ip: clientIp(req) },
  })
  res.json({ repair_booking: { id: result.id, status: result.status } })
}
