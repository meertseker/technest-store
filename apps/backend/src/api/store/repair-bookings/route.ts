import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { clientIp } from "../../../lib/rate-limit"
import { resolveTurnstileVerifier } from "../../../lib/turnstile"
import { createRepairBookingWorkflow } from "../../../workflows/create-repair-booking"
import { StoreCreateRepairBooking } from "./middlewares"

export async function POST(
  req: MedusaRequest<StoreCreateRepairBooking>,
  res: MedusaResponse
) {
  const { turnstile_token, ...booking } = req.validatedBody
  const verify = resolveTurnstileVerifier(req.scope)
  if (!(await verify(turnstile_token, clientIp(req)))) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Turnstile verification failed")
  }
  const { result } = await createRepairBookingWorkflow(req.scope).run({
    input: booking,
  })
  res.json({ repair_booking: { id: result.id, status: result.status } })
}
