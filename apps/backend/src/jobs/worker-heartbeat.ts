import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { reportingJob } from "../lib/alerting"
import { HEARTBEAT_EVENT, heartbeatUrl } from "../lib/alerting/heartbeat"

/**
 * Every 5 minutes: put a heartbeat on the event queue. The subscriber
 * (subscribers/worker-heartbeat.ts) pings the monitor when the event comes
 * out the other end. See lib/alerting/heartbeat. Nothing without WORKER_HEARTBEAT_URL.
 */
async function workerHeartbeatJob(container: MedusaContainer) {
  if (!heartbeatUrl()) return
  await container
    .resolve(Modules.EVENT_BUS)
    .emit({ name: HEARTBEAT_EVENT, data: { at: new Date().toISOString() } })
}

export default reportingJob("worker-heartbeat", workerHeartbeatJob)

export const config = {
  name: "worker-heartbeat",
  schedule: "*/5 * * * *",
}
