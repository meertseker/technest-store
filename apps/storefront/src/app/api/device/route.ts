import { NextRequest, NextResponse } from "next/server"
import { listDevices } from "@lib/data/devices"
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  isDeviceSlug,
  PICKER_PATH,
  safeReturnPath,
} from "@/lib/devices/cookie"
import { findDevice } from "@/lib/devices/tree"
import { isSameOriginRequest } from "@/lib/http/same-origin"
import { seeOther } from "@/lib/http/see-other"

export const dynamic = "force-dynamic"

const formOf = (req: NextRequest) => req.formData().catch(() => new FormData())

/**
 * Choose a device: <form method="post" action="/api/device"> with
 * <button name="slug" value="iphone-15-pro"> and an optional hidden returnTo.
 * A plain form POST (not a server action) so it behaves the same with and
 * without JavaScript and always ends in a full page load with the new header.
 * Sets tn_device and sends the shopper back to returnTo (validated), else home.
 */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req.headers)) {
    return new NextResponse("Forbidden", { status: 403 })
  }
  const form = await formOf(req)
  const slug = form.get("slug")
  const returnTo = safeReturnPath(form.get("returnTo") as string | null)
  if (!isDeviceSlug(slug) || !findDevice(await listDevices(), slug)) {
    return seeOther(
      returnTo ? `${PICKER_PATH}?${new URLSearchParams({ returnTo })}` : PICKER_PATH
    )
  }
  const res = seeOther(returnTo ?? "/")
  res.cookies.set(DEVICE_COOKIE, slug, deviceCookieOptions())
  return res
}
