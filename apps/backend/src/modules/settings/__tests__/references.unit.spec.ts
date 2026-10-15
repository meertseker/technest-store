import { MedusaError } from "@medusajs/framework/utils"
import { REFERENCE_KEYS, setReference } from "../references"

const KEY = REFERENCE_KEYS.TRADE_CUSTOMER_GROUP_ID

/** A settings service whose create loses a race: another caller stored the key first. */
function racingService(createError: unknown, winner: { id: string; value: string } | null) {
  let reads = 0
  return {
    listTechnestReferences: jest.fn(async () => (reads++ === 0 ? [] : winner ? [winner] : [])),
    createTechnestReferences: jest.fn(async () => {
      throw createError
    }),
    updateTechnestReferences: jest.fn(),
    deleteTechnestReferences: jest.fn(),
  }
}

const containerWith = (service: unknown) => ({ resolve: () => service }) as any

// What Medusa's database error mapper throws for a unique violation (Postgres 23505).
const uniqueViolation = new MedusaError(
  MedusaError.Types.INVALID_DATA,
  "Technest reference with key: trade_customer_group_id, already exists."
)

describe("setReference when two callers store the same key at once", () => {
  it("keeps the row the other caller stored instead of failing", async () => {
    const service = racingService(uniqueViolation, { id: "tref_1", value: "cusgroup_winner" })
    await expect(setReference(containerWith(service), KEY, "cusgroup_mine")).resolves.toBeNull()
    expect(service.createTechnestReferences).toHaveBeenCalledTimes(1)
    expect(service.listTechnestReferences).toHaveBeenCalledTimes(2)
  })

  it("still fails when the create failed for another reason (no row was stored)", async () => {
    const service = racingService(new Error("connection lost"), null)
    await expect(setReference(containerWith(service), KEY, "cusgroup_mine")).rejects.toThrow("connection lost")
  })
})
