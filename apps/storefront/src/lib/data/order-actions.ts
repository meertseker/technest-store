"use server"

import { acceptTransferRequest, declineTransferRequest } from "./orders"

/*
 * The two buttons on the "move this order to another account" page. Only
 * whether it worked goes back to the browser.
 */

const valid = (id: unknown, token: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_]{1,64}$/.test(id) && typeof token === "string" && !!token && token.length <= 2000

export async function acceptTransferAction(id: unknown, token: unknown): Promise<{ success: boolean }> {
  if (!valid(id, token)) return { success: false }
  const { success } = await acceptTransferRequest(id, token as string)
  return { success }
}

export async function declineTransferAction(id: unknown, token: unknown): Promise<{ success: boolean }> {
  if (!valid(id, token)) return { success: false }
  const { success } = await declineTransferRequest(id, token as string)
  return { success }
}
