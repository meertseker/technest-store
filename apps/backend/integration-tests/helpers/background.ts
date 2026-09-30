import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

const FINISHED = ["not_started", "done", "reverted", "failed"]

/**
 * Waits until no workflow is running in the background (e.g. the send-email
 * workflows that subscribers start after an API call), and stays that way for
 * `quietMs`. The quiet period covers subscribers that are about to start a
 * workflow: the local event bus delivers events asynchronously, after the
 * request that emitted them has returned.
 *
 * Call it at the end of a suite's `beforeAll` whenever the fixtures emit events
 * with subscribers. The runner snapshots the DB right after `beforeAll` by
 * terminating every connection: a workflow still running then fails mid-step
 * and, worse, its execution row is captured in the snapshot as "invoking".
 * Every restore brings that row back, and the runner's `afterEach`
 * (waitWorkflowExecutions) polls for it forever.
 */
export async function waitForBackgroundWork(
  container: MedusaContainer,
  { quietMs = 300, timeoutMs = 120_000, pollMs = 50 } = {}
) {
  const engine = container.resolve(Modules.WORKFLOW_ENGINE)
  const deadline = Date.now() + timeoutMs
  let quietSince: number | null = null
  for (;;) {
    const running = await engine.listWorkflowExecutions({ state: { $nin: FINISHED } } as never)
    const now = Date.now()
    if (running.length) {
      quietSince = null
      if (now > deadline) {
        const ids = running.map((e: { workflow_id: string; state: string }) => `${e.workflow_id} (${e.state})`)
        throw new Error(`Background workflows still running after ${timeoutMs} ms: ${ids.join(", ")}`)
      }
    } else if (quietSince === null) {
      quietSince = now
    } else if (now - quietSince >= quietMs) {
      return
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }
}
