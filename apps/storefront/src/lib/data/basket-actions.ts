"use server"

import { deleteLineItem, updateLineItem } from "./cart"

/**
 * Basket line actions. They are plain form actions, so the quantity stepper and
 * Remove button also work on /basket without JavaScript (progressive enhancement).
 */
export type LineActionState = { error: string | null; at: number }

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : ""
  if (/inventory|stock/i.test(msg)) return "Sorry, we don't have that many in stock."
  return "We couldn't update your basket. Please try again."
}

export async function changeLineQuantity(
  _prev: LineActionState,
  formData: FormData
): Promise<LineActionState> {
  const lineId = String(formData.get("line_id") ?? "")
  const quantity = Number(formData.get("quantity"))
  if (!lineId || !Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    return { error: "Choose a quantity between 1 and 99.", at: Date.now() }
  }
  try {
    if (quantity === 0) await deleteLineItem(lineId)
    else await updateLineItem({ lineId, quantity })
    return { error: null, at: Date.now() }
  } catch (e) {
    return { error: friendly(e), at: Date.now() }
  }
}

export async function removeLine(
  _prev: LineActionState,
  formData: FormData
): Promise<LineActionState> {
  const lineId = String(formData.get("line_id") ?? "")
  if (!lineId) return { error: "We couldn't find that item.", at: Date.now() }
  try {
    await deleteLineItem(lineId)
    return { error: null, at: Date.now() }
  } catch (e) {
    return { error: friendly(e), at: Date.now() }
  }
}
