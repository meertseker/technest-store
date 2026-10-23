import { Alert, Badge, Button, Container, Heading, Input, Label, Text, clx, toast } from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { sdk } from "../../lib/client"
import { errorMessage, plural } from "../../lib/format"
import { penceToPoundsInput, poundsInputToPence } from "../../lib/pence"
import {
  inputsToRefresh,
  isStaleStockError,
  PRICE_STOCK_FIELDS,
  priceStockBody,
  type PriceStockResponse,
  type ProductForRows,
  stockInputToNumber,
  type VariantRow,
  variantRows,
} from "../../lib/price-stock"
import { useDebounced } from "../../lib/use-debounced"
import { PageLoading, TAP, Thumb } from "../shop-ui"

// The Price & stock tab of the Products page: find a product, change its
// price (VAT included) or how many are in stock, save. Everything else about a
// product is on its Medusa page. Contract: docs/contracts/price-stock.md.

const PAGE_SIZE = 20
export const PRICE_STOCK_QUERY_KEY = ["price-stock"] as const

const PRICE_HINT = "Price must be pounds and pence, like 4.99"
const STOCK_HINT = "Stock must be a whole number, like 12"

export function VariantRowCard({ row }: { row: VariantRow }) {
  const queryClient = useQueryClient()
  const [price, setPrice] = useState(row.price_pence === null ? "" : penceToPoundsInput(row.price_pence))
  const [stock, setStock] = useState(row.stock === null ? "" : String(row.stock))
  const [saved, setSaved] = useState<PriceStockResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A value the server changed (after a refetch) wins over what was typed before; a value
  // it did not change keeps what was typed (after a 409 only the stock moved).
  const [shown, setShown] = useState({ price_pence: row.price_pence, stock: row.stock })
  useEffect(() => {
    const next = { price_pence: row.price_pence, stock: row.stock }
    const refresh = inputsToRefresh(shown, next)
    if (!refresh.price && !refresh.stock) return
    if (refresh.price) setPrice(row.price_pence === null ? "" : penceToPoundsInput(row.price_pence))
    if (refresh.stock) setStock(row.stock === null ? "" : String(row.stock))
    setShown(next)
    setSaved(null)
  }, [row.price_pence, row.stock])

  const pricePence = price.trim() === "" ? null : poundsInputToPence(price)
  const stockNumber = stock.trim() === "" ? null : stockInputToNumber(stock)
  const priceInvalid = price.trim() !== "" && (pricePence === null || pricePence < 1)
  const stockInvalid = stock.trim() !== "" && stockNumber === null
  const body = priceStockBody(row, { price_pence: pricePence, stock: stockNumber })
  const canSave = !priceInvalid && !stockInvalid && Object.keys(body).length > 0

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<PriceStockResponse>(
        `/admin/products/${row.product_id}/variants/${row.variant_id}/price-stock`,
        {
          method: "POST",
          body,
        }
      ),
    onMutate: () => setError(null),
    onSuccess: (r) => {
      setSaved(r)
      toast.success(`${row.product_title}${row.variant_title ? ` (${row.variant_title})` : ""} saved`)
      queryClient.invalidateQueries({ queryKey: PRICE_STOCK_QUERY_KEY })
    },
    onError: (e: unknown) => {
      setError(errorMessage(e))
      // The stock moved since the page loaded: nothing was written. Reload the row so the
      // fields show the new number (the effect above puts it in the inputs) and ask again.
      if (isStaleStockError(e)) queryClient.invalidateQueries({ queryKey: PRICE_STOCK_QUERY_KEY })
    },
  })

  const priceId = `ps-price-${row.variant_id}`
  const stockId = `ps-stock-${row.variant_id}`
  const titleId = `ps-title-${row.variant_id}`

  return (
    <li
      className="bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-3 rounded-lg p-4"
      aria-labelledby={titleId}
    >
      <div className="flex items-start gap-3">
        <Thumb src={row.thumbnail} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text as="span" size="large" weight="plus" id={titleId} className="break-words">
            {row.product_title}
            {row.variant_title ? ` · ${row.variant_title}` : ""}
          </Text>
          <Text as="span" size="large" className="text-ui-fg-subtle">
            {row.sku ? `SKU ${row.sku}` : "No SKU"}
          </Text>
        </div>
        <Badge size="small" color={row.status === "published" ? "green" : row.status === "draft" ? "orange" : "grey"}>
          {row.status === "published" ? "Live" : row.status === "draft" ? "Draft" : "Hidden"}
        </Badge>
      </div>

      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save.mutate()
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor={priceId} size="base">
            Price £ (inc. VAT)
          </Label>
          <Input
            id={priceId}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={priceInvalid}
            aria-describedby={priceInvalid ? `${priceId}-hint` : undefined}
            className="min-h-11 text-base"
            placeholder={row.price_pence === null ? "No price yet" : undefined}
          />
          {priceInvalid && (
            <Text size="small" className="text-ui-fg-error" id={`${priceId}-hint`}>
              {PRICE_HINT}
            </Text>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={stockId} size="base">
            In stock
          </Label>
          <Input
            id={stockId}
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            aria-invalid={stockInvalid}
            aria-describedby={stockInvalid ? `${stockId}-hint` : undefined}
            className="min-h-11 text-base"
            placeholder={row.stock === null ? "Not tracked" : undefined}
          />
          {stockInvalid && (
            <Text size="small" className="text-ui-fg-error" id={`${stockId}-hint`}>
              {STOCK_HINT}
            </Text>
          )}
        </div>
        <Button
          type="submit"
          size="large"
          className={clx(TAP, "w-full sm:w-auto")}
          disabled={!canSave || save.isPending}
          isLoading={save.isPending}
        >
          {saved && !canSave ? "Saved" : "Save"}
        </Button>
      </form>

      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}

      <Text size="large" className="text-ui-fg-subtle">
        Photo, name, colours or sizes:{" "}
        <Link to={`/products/${row.product_id}`} className="text-ui-fg-interactive underline-offset-2 hover:underline">
          open the product
        </Link>
        .
      </Text>
    </li>
  )
}

export const PriceStock = () => {
  const [params, setParams] = useSearchParams()
  const draftsOnly = params.get("drafts") === "1"
  const [q, setQ] = useState("")
  const search = useDebounced(q.trim(), 300)

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: [...PRICE_STOCK_QUERY_KEY, search, draftsOnly],
    queryFn: () =>
      sdk.admin.product.list({
        q: search || undefined,
        limit: PAGE_SIZE,
        order: "-created_at",
        status: draftsOnly ? ["draft"] : undefined,
        fields: PRICE_STOCK_FIELDS,
      }),
    placeholderData: keepPreviousData,
  })
  const rows = variantRows((data?.products ?? []) as unknown as ProductForRows[])

  const setDrafts = (on: boolean) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (on) next.set("drafts", "1")
        else next.delete("drafts")
        return next
      },
      { replace: true }
    )

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <Heading level="h2">Price & stock</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Find the product, change the price or how many you have, press Save.
        </Text>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ps-search" size="base">
            Search by name or SKU
          </Label>
          <Input
            id="ps-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11 text-base"
            placeholder="e.g. USB-C cable"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          <Button type="button" variant={draftsOnly ? "secondary" : "primary"} aria-pressed={!draftsOnly} className={TAP} onClick={() => setDrafts(false)}>
            All products
          </Button>
          <Button type="button" variant={draftsOnly ? "primary" : "secondary"} aria-pressed={draftsOnly} className={TAP} onClick={() => setDrafts(true)}>
            Drafts only
          </Button>
        </div>
      </Container>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <Alert variant="error" role="alert">
          {errorMessage(error)}
        </Alert>
      ) : rows.length === 0 ? (
        <Text size="large" className="text-ui-fg-subtle px-1">
          {search ? `Nothing matches "${search}".` : draftsOnly ? "No drafts." : "No products yet."}
        </Text>
      ) : (
        <>
          <Text size="large" className="text-ui-fg-subtle px-1" aria-live="polite">
            {isFetching ? "Updating…" : `Showing the ${search ? "best matches" : "newest"}: ${plural(rows.length, "item")}`}
            {(data?.count ?? 0) > PAGE_SIZE && !search ? ". Search to find older ones." : ""}
          </Text>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rows.map((r) => (
              <VariantRowCard key={r.variant_id} row={r} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
