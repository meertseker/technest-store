import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import TradeStatus from "./trade-status"
import type { TradeApplication } from "@/lib/trade/types"

const application = (status: TradeApplication["status"], reason: string | null = null): TradeApplication => ({
  id: "tapp_1",
  customer_id: "cus_1",
  company_name: "Acme Phones Ltd",
  vat_number: null,
  companies_house_number: null,
  business_type: "limited_company",
  contact: { name: "Jane", phone: "020 7946 0000", email: "jane@acme.test" },
  status,
  reason,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
})

describe("TradeStatus", () => {
  it("a closed account: the badge says Closed, the reason is shown, and there is a way to apply again", () => {
    const html = renderToStaticMarkup(<TradeStatus application={application("revoked", "Account no longer trading")} />)
    expect(html).toContain("Closed")
    expect(html).toMatch(/trade account has been closed/i)
    expect(html).toContain("Our reason")
    expect(html).toContain("Account no longer trading")
    expect(html).toMatch(/href="\/trade\/apply"[^>]*>Apply again/)
  })

  it("a closed account without a reason shows no empty reason box", () => {
    const html = renderToStaticMarkup(<TradeStatus application={application("revoked")} />)
    expect(html).not.toContain("Our reason")
  })

  it("an approved account still points at the shop, not at the form", () => {
    const html = renderToStaticMarkup(<TradeStatus application={application("approved")} />)
    expect(html).toContain("Shop with trade prices")
    expect(html).not.toContain("Apply again")
  })
})
