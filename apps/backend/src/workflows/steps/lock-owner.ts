import { randomUUID } from "crypto"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * A lock owner id unique to one run of one workflow.
 *
 * Without one, every lock is taken and released as the same owner, so a run
 * that outlived its lock's TTL would, on release, delete the lock the next
 * run now holds. With it, the locking providers only release a lock to the
 * run that took it.
 */
export const newLockOwnerId = (workflow: string) => `technest:${workflow}:${randomUUID()}`

/**
 * Makes the run's lock owner id. A step (not a transform) so the id is stored
 * with the run: the acquire, the release and the acquire's compensation all
 * see the same value.
 */
export const lockOwnerStep = createStep(
  "technest-lock-owner",
  async ({ workflow }: { workflow: string }) => new StepResponse(newLockOwnerId(workflow))
)
