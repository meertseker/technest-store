import { MedusaError } from "@medusajs/framework/utils"

/**
 * True for the error the locking providers throw when a lock is still held
 * by another run after the wait. Both providers (in-memory: plain Error,
 * Redis: MedusaError CONFLICT) say "Failed to acquire lock for key ..." from
 * acquire() and "Timed-out acquiring lock." from execute().
 */
export const isLockBusyError = (e: unknown) =>
  /Failed to acquire lock|Timed-out acquiring lock/.test((e as Error | undefined)?.message ?? "")

/**
 * Runs a workflow for an API route and turns a busy lock into a 409 with a
 * readable message (instead of the provider's error becoming a 500).
 */
export async function runOrConflict<T>(run: () => Promise<T>, message: string): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (isLockBusyError(e)) {
      throw new MedusaError(MedusaError.Types.CONFLICT, message)
    }
    throw e
  }
}
