import { NextRequest, NextResponse } from "next/server"
import { DEVICE_COOKIE, PICKER_PATH, safeReturnPath } from "@/lib/devices/cookie"
import { isSameOriginRequest } from "@/lib/http/same-origin"
import { seeOther } from "@/lib/http/see-other"

export const dynamic = "force-dynamic"

/** "Show all devices instead": forget tn_device, back to returnTo or the picker */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req.headers)) {
    return new NextResponse("Forbidden", { status: 403 })
  }
  const form = await req.formData().catch(() => new FormData())
  const res = seeOther(safeReturnPath(form.get("returnTo") as string | null) ?? PICKER_PATH)
  res.cookies.delete(DEVICE_COOKIE)
  return res
}
