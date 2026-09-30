import { getTradeTiers } from "@lib/data/trade"
import TradeTierTable from "./trade-tier-table"

type Props = {
  productId: string
  variantId?: string | null
  className?: string
}

/**
 * Drop-in for the product page (catalogue branch):
 *
 *   <Suspense fallback={null}><TradeTierPrices productId={product.id} /></Suspense>
 *
 * Server component. Shows the approved trade customer's tier prices ex VAT
 * (GET /store/products/:id/trade-tiers) and renders nothing for guests,
 * retail customers, pending applications or on any error. The data is
 * personal, so it is fetched per request and never cached.
 */
export default async function TradeTierPrices({ productId, variantId, className }: Props) {
  const data = await getTradeTiers(productId)
  if (!data) return null
  return <TradeTierTable data={data} variantId={variantId} className={className} />
}
