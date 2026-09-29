import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deviceMatchesQuery, DeviceDTO } from "../../../modules/device/utils"
import { createDevicesWorkflow } from "../../../workflows/create-devices"
import { listDevicesWithCreatedAt, retrieveDeviceById } from "../../utils/devices"
import { AdminCreateDevice, AdminGetDevicesParams } from "./middlewares"

type Sortable = DeviceDTO & { created_at?: string | Date }

function compareBy(field: string) {
  const desc = field.startsWith("-")
  const key = (desc ? field.slice(1) : field) as keyof Sortable
  return (a: Sortable, b: Sortable) => {
    const value = (v: unknown) => (v instanceof Date ? v.getTime() : v ?? "")
    const av = value(a[key])
    const bv = value(b[key])
    const result =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "en", { sensitivity: "base", numeric: true })
    return desc ? -result : result
  }
}

export async function GET(
  req: MedusaRequest<unknown, AdminGetDevicesParams>,
  res: MedusaResponse
) {
  const { q, type, brand, limit, offset, order } = req.validatedQuery
  const all: Sortable[] = await listDevicesWithCreatedAt(req.scope, {
    ...(type ? { type } : {}),
    ...(brand ? { brand } : {}),
  })

  const matching = all
    .filter((device) => deviceMatchesQuery(device, q ?? ""))
    .sort(compareBy(order ?? "model"))

  res.json({
    devices: matching.slice(offset, offset + limit).map(({ created_at: _, ...d }) => d),
    count: matching.length,
    offset,
    limit,
  })
}

export async function POST(
  req: MedusaRequest<AdminCreateDevice>,
  res: MedusaResponse
) {
  const { result } = await createDevicesWorkflow(req.scope).run({
    input: { devices: [req.validatedBody] },
  })
  const device = await retrieveDeviceById(req.scope, result[0].id)
  res.json({ device })
}
