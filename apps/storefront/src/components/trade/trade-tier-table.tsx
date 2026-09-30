import { BadgeCheck } from "lucide-react"
import { formatUnitPence, savingPercent, tierRange } from "@/lib/trade/format"
import type { TradeTiersResponse, TradeTierVariant } from "@/lib/trade/types"
import { cn } from "@/lib/utils"

type Props = {
  data: TradeTiersResponse
  /** Show only this variant (the one selected on the product page) */
  variantId?: string | null
  className?: string
}

/**
 * Trade tier prices, ex VAT with a visible label (CLAUDE.md: trade prices are
 * shown ex-VAT with a label). Pure and synchronous so it is easy to test and
 * can be reused by a client variant picker. Renders nothing without tiers.
 */
export default function TradeTierTable({ data, variantId, className }: Props) {
  const variants = data.variants.filter(
    (v) => v.tiers.length > 0 && (!variantId || v.variant_id === variantId)
  )
  if (variants.length === 0) return null
  const showTitles = variants.length > 1

  return (
    <section
      aria-labelledby="trade-prices-title"
      className={cn("rounded border border-border bg-surface p-4", className)}
      data-testid="trade-tier-prices"
    >
      <h2 id="trade-prices-title" className="flex items-center gap-2 text-lg font-semibold">
        <BadgeCheck aria-hidden className="size-5 text-success" />
        Your trade prices
        <span className="rounded-full bg-background px-2 py-0.5 text-sm font-semibold text-foreground ring-1 ring-border-strong">
          {data.price_label}
        </span>
      </h2>
      <p className="mt-1 text-muted-foreground">
        Prices each, excluding VAT at {data.vat_rate_percent}%. Your basket adds VAT at checkout.
      </p>
      {variants.map((v) => (
        <VariantTiers key={v.variant_id} variant={v} label={data.price_label} showTitle={showTitles} />
      ))}
    </section>
  )
}

function VariantTiers({ variant, label, showTitle }: { variant: TradeTierVariant; label: string; showTitle: boolean }) {
  return (
    <table className="mt-3 w-full border-collapse text-left tabular-nums">
      <caption className={cn("text-left font-semibold", !showTitle && "sr-only")}>
        {showTitle ? variant.title : `Trade prices for ${variant.title}`}
      </caption>
      <thead>
        <tr className="border-b border-border-strong">
          <th scope="col" className="py-2 pr-4 font-semibold">
            Quantity
          </th>
          <th scope="col" className="py-2 pr-4 font-semibold">
            Price each <span className="font-normal">({label})</span>
          </th>
          <th scope="col" className="py-2 font-semibold">
            <span className="sr-only">Saving against retail</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {variant.tiers.map((t) => {
          const save = savingPercent(variant.retail_inc_vat_pence, t.unit_price_inc_vat_pence)
          return (
            <tr key={t.min_quantity} className="border-b border-border last:border-0">
              <th scope="row" className="whitespace-nowrap py-2 pr-4 align-top font-normal">
                {tierRange(t)}
              </th>
              <td className="py-2 pr-4 align-top">
                <span className="block font-bold">{formatUnitPence(t.unit_price_ex_vat_pence)}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatUnitPence(t.unit_price_inc_vat_pence)} inc VAT
                </span>
              </td>
              <td className="whitespace-nowrap py-2 align-top font-semibold text-success">{save ? `Save ${save}%` : ""}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
