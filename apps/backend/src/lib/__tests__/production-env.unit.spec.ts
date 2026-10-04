import { missingProductionEnv } from "../production-env"

const complete = {
  NODE_ENV: "production",
  STRIPE_API_KEY: "sk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  REDIS_URL: "redis://redis:6379",
}

describe("missingProductionEnv", () => {
  it("asks for nothing outside production", () => {
    expect(missingProductionEnv({ NODE_ENV: "development" })).toEqual([])
    expect(missingProductionEnv({})).toEqual([])
  })

  it("is satisfied by a complete production environment", () => {
    expect(missingProductionEnv(complete)).toEqual([])
  })

  // Without Redis the server and the worker would each keep their own locks and event queue in memory.
  it.each([["REDIS_URL"], ["STRIPE_API_KEY"], ["STRIPE_WEBHOOK_SECRET"]])("names %s when it is missing or blank", (name) => {
    expect(missingProductionEnv({ ...complete, [name]: undefined })).toEqual([name])
    expect(missingProductionEnv({ ...complete, [name]: "  " })).toEqual([name])
  })
})
