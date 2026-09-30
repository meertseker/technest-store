import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * The test runner snapshots/restores the DB around each test by terminating
 * every connection to it, which leaves dead connections in the app's pool.
 * Retry a trivial query until the pool has recovered, so the test itself
 * doesn't hit a dead connection (and trip a 60 s workflow retry).
 */
export async function warmDb(container: MedusaContainer, attempts = 10) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (let i = 0; i < attempts; i++) {
    try {
      await query.graph({ entity: "region", fields: ["id"], pagination: { take: 1 } })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}
