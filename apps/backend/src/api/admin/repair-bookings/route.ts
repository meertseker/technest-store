import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listRepairBookingDTOs } from "../../utils/repairs"
import { AdminGetRepairBookingsParams } from "./middlewares"

export async function GET(
  req: MedusaRequest<unknown, AdminGetRepairBookingsParams>,
  res: MedusaResponse
) {
  const { status, limit, offset, order } = req.validatedQuery
  const { bookings, count } = await listRepairBookingDTOs(req.scope, {
    filters: status ? { status } : {},
    order,
    limit,
    offset,
  })
  res.json({ repair_bookings: bookings, count, limit, offset })
}
