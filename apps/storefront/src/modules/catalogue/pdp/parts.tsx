import Link from "next/link"
import { ChevronDown, CircleCheck, Smartphone, Store, Truck, TriangleAlert, Zap } from "lucide-react"
import type { DeliveryLine } from "@/lib/catalogue/delivery"
import type { SpecRow } from "@/lib/catalogue/attributes"
import type { LinkedDevice } from "@/lib/devices/types"

export type FitStatus =
  | { kind: "fits"; device: string; note: string | null }
  | { kind: "doesnt-fit"; device: string; seeHref: string }
  | { kind: "choose"; pickerHref: string }
  | { kind: "none" }

/**
 * The fit box (spec 7.3). Green when the product is linked to the shopper's
 * device, amber when it's linked to other devices only, neutral when no
 * device is chosen. Products not linked to any device (a plug charger) and
 * an unknown device list show nothing: we never guess "doesn't fit".
 */
export function FitBox({ status }: { status: FitStatus }) {
  if (status.kind === "none") return null
  if (status.kind === "fits") {
    return (
      <div className="mt-4 flex gap-3 rounded bg-success-subtle p-4 text-success">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Fits your {status.device}</p>
          {status.note && <p className="text-foreground">{status.note}</p>}
        </div>
      </div>
    )
  }
  if (status.kind === "doesnt-fit") {
    return (
      <div className="mt-4 flex gap-3 rounded bg-warning-subtle p-4">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        <p>
          <span className="font-semibold text-warning">Doesn&apos;t fit your {status.device}</span>
          <br />
          <Link
            href={status.seeHref}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            See ones that do
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div className="mt-4 flex items-center gap-3 rounded border border-border p-4">
      <Smartphone aria-hidden className="size-5 shrink-0" />
      <p>
        Check it fits:{" "}
        <Link
          href={status.pickerHref}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          choose your device
        </Link>
      </p>
    </div>
  )
}

const ICONS = { collect: Store, standard: Truck, "next-day": Zap } as const

export function DeliveryBox({ lines, fallbackNote }: { lines: DeliveryLine[]; fallbackNote?: boolean }) {
  return (
    <section aria-labelledby="delivery-heading" className="mt-6 rounded border border-border p-4">
      <h2 id="delivery-heading" className="text-lg font-semibold">
        Delivery and collection
      </h2>
      <ul className="mt-2 space-y-3">
        {lines.map((l) => {
          const Icon = ICONS[l.id]
          return (
            <li key={l.id} className="flex gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p>
                <span className="font-semibold">{l.title}</span>
                <br />
                <span className="text-muted-foreground">{l.detail}</span>
              </p>
            </li>
          )
        })}
      </ul>
      {fallbackNote && (
        <p className="mt-3 text-muted-foreground">
          Your basket shows the exact delivery price before you pay.
        </p>
      )}
    </section>
  )
}

/** Native <details>: keyboard and screen-reader friendly with no JavaScript */
export function Accordion({
  title,
  children,
  open,
}: {
  title: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group border-b border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden
          className="size-5 shrink-0 transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  )
}

export function Specs({
  summary,
  rows,
  devices,
}: {
  summary: string[]
  rows: SpecRow[]
  devices: LinkedDevice[] | null
}) {
  const fits = devices?.map((d) => (d.note ? `${d.model} (${d.note})` : d.model)) ?? []
  if (!summary.length && !rows.length && !fits.length) {
    return <p className="text-muted-foreground">Ask us in the shop or call us for the full specifications.</p>
  }
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-8">
      {summary.length > 0 && (
        <div>
          <h3 className="font-semibold">In plain English</h3>
          <p className="mt-1 max-w-[68ch]">{summary.join(" ")}</p>
        </div>
      )}
      <div className="mt-4 lg:mt-0">
        <table className="w-full text-left">
          <caption className="sr-only">Specifications</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border">
                <th scope="row" className="py-2 pr-4 align-top font-normal text-muted-foreground">
                  {r.label}
                </th>
                <td className="py-2">{r.value}</td>
              </tr>
            ))}
            {fits.length > 0 && (
              <tr className="border-b border-border">
                <th scope="row" className="py-2 pr-4 align-top font-normal text-muted-foreground">
                  Fits
                </th>
                <td className="py-2">{fits.join(", ")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
