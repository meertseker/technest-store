import Link from "next/link"
import { legalDetails } from "@/lib/legal/business"
import { formatTime, siteConfig } from "@/lib/site-config"

/** [LEAD?] A fact the lead still has to confirm: shown in brackets, highlighted, never hidden or invented */
export function Pending({ label }: { label: string }) {
  return (
    <mark className="rounded-sm bg-warning-subtle px-1 font-semibold text-warning">
      [{label}: to be confirmed]
    </mark>
  )
}

const orPending = (value: string | null, label: string) =>
  value ? <>{value}</> : <Pending label={label} />

export const LegalName = () => orPending(legalDetails.legalName, "legal business name")
export const VatNumber = () => orPending(legalDetails.vatNumber, "VAT number")
export const CompanyNumber = () =>
  orPending(legalDetails.companyNumber, "company number, or sole trader")
export const IcoNumber = () => orPending(legalDetails.icoNumber, "ICO registration number")

export const ShopAddress = () => <>{siteConfig.address.oneLine}</>

export const ShopPhone = () => (
  <a href={`tel:${siteConfig.phone.e164}`} className="font-semibold underline underline-offset-4">
    {siteConfig.phone.display}
  </a>
)

export function ShopEmail() {
  const { email } = legalDetails
  if (!email) return <Pending label="customer service email address" />
  return (
    <a href={`mailto:${email}`} className="font-semibold underline underline-offset-4">
      {email}
    </a>
  )
}

/** Opening hours from the Google profile, one line per day */
export function ShopHours() {
  return (
    <span className="mt-3 block">
      {siteConfig.hours.map((h) => (
        <span key={h.day} className="block">
          {h.day}:{" "}
          <span className="tabular-nums">
            {h.opens && h.closes ? `${formatTime(h.opens)}–${formatTime(h.closes)}` : "Closed"}
          </span>
        </span>
      ))}
    </span>
  )
}

/** Internal link styled for running legal text */
export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold underline underline-offset-4">
      {children}
    </Link>
  )
}

/** External link that says it opens a new tab */
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline underline-offset-4"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
