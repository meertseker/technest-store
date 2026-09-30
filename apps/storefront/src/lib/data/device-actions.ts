"use server"

import { cookies as nextCookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  isDeviceSlug,
  safeReturnPath,
} from "@/lib/devices/cookie"
import { findDevice } from "@/lib/devices/tree"
import { listDevices } from "./devices"

/** Form action: <button name="slug" value="iphone-15-pro"> + hidden returnTo */
export async function chooseDevice(formData: FormData) {
  const slug = formData.get("slug")
  const returnTo = safeReturnPath(formData.get("returnTo") as string | null)
  if (!isDeviceSlug(slug) || !findDevice(await listDevices(), slug)) {
    redirect("/devices")
  }
  ;(await nextCookies()).set(DEVICE_COOKIE, slug, {
    maxAge: DEVICE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  redirect(returnTo ?? "/")
}

export async function clearDevice(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo") as string | null)
  ;(await nextCookies()).delete(DEVICE_COOKIE)
  redirect(returnTo ?? "/devices")
}
