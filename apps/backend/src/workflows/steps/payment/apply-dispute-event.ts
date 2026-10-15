import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PaymentNoticeMeta } from "../../../lib/stripe-events/constants"

export type DisputeFacts = {
  id: string
  status: string
  reason: string
  amount_pence: number
  currency: string
  due_by: string | null
  livemode: boolean
}

export type ApplyDisputeEventInput = {
  order_id: string
  dispute: DisputeFacts
  /** charge.dispute.created / updated / closed */
  event_type: string
  /** The Stripe event's `created` time (Unix seconds). */
  event_at: number
}

/** opened: first time we see this dispute; known: a redelivered opening; updated; stale: older or after close. */
export type DisputeEventState = "opened" | "known" | "updated" | "stale"

export type DisputeRecord = DisputeFacts & { opened_at: string; event_at: number; closed_at?: string }

/**
 * Applies one dispute event to the order's `disputes` (one record per
 * dispute id), re-reading them under the order's lock so two events can't
 * overwrite each other. Stripe doesn't promise delivery order: an event
 * older than the one already applied, or anything after the close, changes
 * nothing.
 */
export const applyDisputeEventStep = createStep(
  "apply-dispute-event",
  async (input: ApplyDisputeEventInput, { container }) => {
    const order = await container
      .resolve(Modules.ORDER)
      .retrieveOrder(input.order_id, { select: ["id", "metadata"] })
    const disputes = ((order.metadata ?? {})[PaymentNoticeMeta.DISPUTES] ?? {}) as Record<string, DisputeRecord>
    const current = disputes[input.dispute.id]
    const now = new Date().toISOString()
    const closed = input.event_type === "charge.dispute.closed"
    const write = (state: DisputeEventState, record: DisputeRecord) =>
      new StepResponse({
        state,
        patch: { [PaymentNoticeMeta.DISPUTES]: { ...disputes, [input.dispute.id]: record } } as Record<string, unknown>,
      })
    const keep = (state: DisputeEventState) => new StepResponse({ state, patch: {} as Record<string, unknown> })

    if (!current) {
      // Also an update or close whose opening was lost: treated as the opening.
      return write("opened", {
        ...input.dispute,
        opened_at: now,
        event_at: input.event_at,
        ...(closed ? { closed_at: now } : {}),
      })
    }
    if (input.event_type === "charge.dispute.created") return keep("known")
    if (current.closed_at || input.event_at < (Number(current.event_at) || 0)) return keep("stale")
    return write("updated", {
      ...current,
      status: input.dispute.status,
      event_at: input.event_at,
      ...(closed ? { closed_at: now } : {}),
    })
  }
)
