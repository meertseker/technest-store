// What the shop has to do today, in plain words, for the Today page and the
// summary above the Orders list. Pure functions: the pages only fetch counts.

import { plural } from "./format"

/** null = the count could not be loaded (never shown as 0) */
export type TodayCounts = {
  to_pick: number | null
  ready: number | null
  repairs_new: number | null
  trade_pending: number | null
  drafts: number | null
}

export type TodayKey = keyof TodayCounts

/**
 * action: a job for the shop. waiting: nothing to do until the customer comes.
 * clear: nothing there. unknown: the count failed to load.
 */
export type TodayTone = "action" | "waiting" | "clear" | "unknown"

export type TodayTask = {
  key: TodayKey
  count: number | null
  tone: TodayTone
  title: string
  detail: string
  /** Admin path, e.g. "/click-collect" */
  to: string
  cta: string
}

type Spec = {
  key: TodayKey
  /** [singular, plural] after the number: "order to pick" */
  noun: [string, string]
  /** Heading when the count is unknown */
  name: string
  none: string
  todo: string
  idle: string
  to: string
  cta: string
  waiting?: boolean
}

// In the order the shop should deal with them
const SPECS: Spec[] = [
  {
    key: "to_pick",
    noun: ["order to pick", "orders to pick"],
    name: "Orders to pick",
    none: "No orders to pick",
    todo: "Click & Collect. Pick the items, then press Mark ready.",
    idle: "New Click & Collect orders appear here.",
    to: "/click-collect",
    cta: "Open the board",
  },
  {
    key: "repairs_new",
    noun: ["repair to call back", "repairs to call back"],
    name: "Repairs to call back",
    none: "No repairs to call back",
    todo: "Call the customer, agree a price, then mark it booked in.",
    idle: "Repair requests from the website appear here.",
    to: "/repair-bookings",
    cta: "Open repairs",
  },
  {
    key: "trade_pending",
    noun: ["trade application to review", "trade applications to review"],
    name: "Trade applications to review",
    none: "No trade applications to review",
    todo: "Check the business, then approve or reject it.",
    idle: "Applications from businesses appear here.",
    to: "/trade-applications",
    cta: "Open applications",
  },
  {
    key: "drafts",
    noun: ["draft product to publish", "draft products to publish"],
    name: "Draft products to publish",
    none: "No draft products",
    todo: "Not on the website yet. Check them, then publish.",
    idle: "Products you add wait here until you publish them.",
    to: "/products?status=draft",
    cta: "Open drafts",
  },
  {
    key: "ready",
    noun: ["order waiting to be collected", "orders waiting to be collected"],
    name: "Orders waiting to be collected",
    none: "Nothing waiting to be collected",
    todo: "On the shelf. Press Collected when the customer comes in.",
    idle: "Orders you mark ready wait here for the customer.",
    to: "/click-collect",
    cta: "Open the board",
    waiting: true,
  },
]

const TONE_ORDER: TodayTone[] = ["action", "unknown", "waiting", "clear"]

/** Jobs for the shop first, then what could not be loaded, then what is waiting or empty */
export function todayTasks(counts: TodayCounts): TodayTask[] {
  return SPECS.map((s): TodayTask => {
    const count = counts[s.key]
    const tone: TodayTone =
      count === null ? "unknown" : count === 0 ? "clear" : s.waiting ? "waiting" : "action"
    return {
      key: s.key,
      count,
      tone,
      title: count === null ? s.name : count === 0 ? s.none : plural(count, s.noun[0], s.noun[1]),
      detail:
        count === null ? "Couldn't load this. Open the page to check." : count === 0 ? s.idle : s.todo,
      to: s.to,
      cta: s.cta,
    }
  }).sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone))
}

/** One line for the top of the page */
export function todaySummary(tasks: TodayTask[]): string {
  const jobs = tasks.filter((t) => t.tone === "action").length
  if (jobs) return `${jobs} ${jobs === 1 ? "thing needs" : "things need"} you today.`
  if (tasks.some((t) => t.tone === "unknown")) return "Some of today's numbers couldn't be loaded."
  return "You're all caught up."
}

const WHO = "Whoever set up the shop can switch this on."

/**
 * Server messages about a feature that is switched off name the setting
 * ("ANTHROPIC_API_KEY is not set"), which means nothing to the shop owner.
 * Keep what it says, drop the setting, and say who can fix it.
 */
export function ownerMessage(reason: string | null | undefined): string | null {
  if (!reason) return null
  const technical = /\([^)]*\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b[^)]*\)|:\s*[A-Z][A-Z0-9]*_[A-Z0-9_]+\b.*$/
  if (!technical.test(reason)) return reason
  const plain = reason
    .replace(/:\s*[A-Z][A-Z0-9]*_[A-Z0-9_]+\b.*$/, ".")
    .replace(/\s*\([^)]*\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b[^)]*\)/g, "")
    .trim()
  return `${plain} ${WHO}`
}

/**
 * True for the pages the admin opens by itself: the base path (which goes to
 * Orders) and the sign-in page (which goes to Orders after signing in). A page
 * the shop opened on purpose, such as one order or Products, is left alone.
 */
export function isLandingPath(pathname: string): boolean {
  return /\/app(\/(orders|login))?\/?$/.test(pathname)
}
