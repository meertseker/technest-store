import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deviceMatchesQuery, groupDevices } from "../../../modules/device/utils"
import { listDeviceDTOs } from "../../utils/devices"
import { StoreGetDevicesParams } from "./middlewares"

// The catalogue is small (~150 devices), so matching on normalised model,
// slug and aliases happens in memory rather than in SQL.
export async function GET(
  req: MedusaRequest<unknown, StoreGetDevicesParams>,
  res: MedusaResponse
) {
  const { q, type } = req.validatedQuery
  const devices = (await listDeviceDTOs(req.scope, type ? { type } : {})).filter(
    (device) => deviceMatchesQuery(device, q ?? "")
  )

  res.json({ brands: groupDevices(devices), count: devices.length })
}
