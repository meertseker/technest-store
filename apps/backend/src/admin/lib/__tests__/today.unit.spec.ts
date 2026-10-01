import { isLandingPath, ownerMessage, todaySummary, todayTasks } from "../today"

const counts = { to_pick: 2, ready: 1, repairs_new: 0, trade_pending: 3, drafts: 4 }

describe("todayTasks", () => {
  it("lists the jobs that need doing first, each with where to go", () => {
    const tasks = todayTasks(counts)
    expect(tasks.map((t) => [t.key, t.count, t.to])).toEqual([
      ["to_pick", 2, "/click-collect"],
      ["trade_pending", 3, "/trade-applications"],
      ["drafts", 4, "/products?status=draft"],
      ["ready", 1, "/click-collect"],
      ["repairs_new", 0, "/repair-bookings"],
    ])
  })

  it("says what to do in plain words, and says so when there is nothing to do", () => {
    const byKey = Object.fromEntries(todayTasks(counts).map((t) => [t.key, t]))
    expect(byKey.to_pick.title).toBe("2 orders to pick")
    expect(byKey.to_pick.detail).toBe("Click & Collect. Pick the items, then press Mark ready.")
    expect(byKey.ready.title).toBe("1 order waiting to be collected")
    expect(byKey.repairs_new.title).toBe("No repairs to call back")
    expect(byKey.repairs_new.tone).toBe("clear")
    expect(byKey.drafts.title).toBe("4 draft products to publish")
  })

  it("orders on the shelf are waiting on the customer, not a job for the shop", () => {
    const ready = todayTasks(counts).find((t) => t.key === "ready")!
    expect(ready.tone).toBe("waiting")
  })

  it("shows a count that could not be loaded as unknown, never as zero", () => {
    const task = todayTasks({ ...counts, to_pick: null }).find((t) => t.key === "to_pick")!
    expect(task.count).toBeNull()
    expect(task.tone).toBe("unknown")
    expect(task.title).toBe("Orders to pick")
    expect(task.detail).toBe("Couldn't load this. Open the page to check.")
  })
})

describe("todaySummary", () => {
  it("counts only the jobs for the shop", () => {
    expect(todaySummary(todayTasks(counts))).toBe("3 things need you today.")
    expect(todaySummary(todayTasks({ ...counts, to_pick: 0, trade_pending: 0 }))).toBe("1 thing needs you today.")
  })

  it("says when everything is done", () => {
    const none = { to_pick: 0, ready: 2, repairs_new: 0, trade_pending: 0, drafts: 0 }
    expect(todaySummary(todayTasks(none))).toBe("You're all caught up.")
  })

  it("does not claim to be caught up when something failed to load", () => {
    const partial = { to_pick: null, ready: 0, repairs_new: 0, trade_pending: 0, drafts: 0 }
    expect(todaySummary(todayTasks(partial))).toBe("Some of today's numbers couldn't be loaded.")
  })
})

describe("ownerMessage", () => {
  it("drops setting names the shop owner can't act on and says who can", () => {
    expect(
      ownerMessage("AI suggestions are switched off (ANTHROPIC_API_KEY is not set). You can still add products by hand.")
    ).toBe(
      "AI suggestions are switched off. You can still add products by hand. Whoever set up the shop can switch this on."
    )
    expect(ownerMessage("Photo processing is switched off (PHOTO_WORKER_URL is not set).")).toBe(
      "Photo processing is switched off. Whoever set up the shop can switch this on."
    )
    expect(
      ownerMessage('Photo processing is switched off: PHOTO_MODEL "u2net" is not allowed (use birefnet-general or isnet-general-use).')
    ).toBe("Photo processing is switched off. Whoever set up the shop can switch this on.")
  })

  it("leaves ordinary messages alone", () => {
    expect(ownerMessage("The photo is too large. Use one under 10 MB.")).toBe(
      "The photo is too large. Use one under 10 MB."
    )
    expect(ownerMessage(null)).toBeNull()
  })
})

describe("isLandingPath", () => {
  it.each(["/app", "/app/", "/app/orders", "/app/orders/", "/app/login"])(
    "%s is where the admin opens by itself, so Today takes over",
    (path) => {
      expect(isLandingPath(path)).toBe(true)
    }
  )

  it.each(["/app/orders/order_123", "/app/products", "/app/today", "/app/click-collect", "/app/settings/technest"])(
    "%s was opened on purpose, so it is left alone",
    (path) => {
      expect(isLandingPath(path)).toBe(false)
    }
  )
})
