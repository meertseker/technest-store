import { ArrowLeft } from "@medusajs/icons"
import { Alert, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { PRICE_STOCK_QUERY_KEY, VariantRowCard } from "../../../src/admin/components/products/price-stock"
import { ConfirmDialog, PageLoading, TAP } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage } from "../../../src/admin/lib/format"
import { PRICE_STOCK_FIELDS, type ProductForRows, variantRows } from "../../../src/admin/lib/price-stock"
import { StatusBadge } from "./all-products"

// One product: its photo, whether it is on sale, and price and stock per
// option (the same card as Products > Price & stock). Descriptions, extra
// photos and categories are edited in the full admin.

type Product = ProductForRows & { description?: string | null; subtitle?: string | null; handle?: string | null }

export function ProductPage() {
  const { id = "" } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const key = [...PRICE_STOCK_QUERY_KEY, "panel-product", id]
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: product, isLoading, isError, error: loadError } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await sdk.client.fetch<{ product: Product }>(`/admin/products/${id}`, {
          query: { fields: `${PRICE_STOCK_FIELDS},description,subtitle,handle` },
        })
      ).product,
  })

  const published = product?.status === "published"
  const setStatus = useMutation({
    mutationFn: (status: "published" | "draft") =>
      sdk.client.fetch(`/admin/products/${id}`, { method: "POST", body: { status } }),
    onMutate: () => setError(null),
    onSuccess: (_r, status) => {
      toast.success(status === "published" ? "On sale. Customers can buy it now." : "Taken off sale.")
      queryClient.invalidateQueries({ queryKey: PRICE_STOCK_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ["panel", "products"] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (isLoading) return <PageLoading />
  if (isError || !product) {
    return (
      <Container className="px-4 py-6">
        <Text size="large" role="alert">
          {errorMessage(loadError, "Couldn't load this product.")}
        </Text>
      </Container>
    )
  }

  const rows = variantRows([product])

  return (
    <div className="flex flex-col gap-4">
      <Link to="/products" className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center gap-1 self-start">
        <ArrowLeft /> All products
      </Link>

      <Container className="flex flex-col gap-4 px-4 py-4 sm:flex-row md:px-6">
        {product.thumbnail ? (
          <img src={product.thumbnail} alt="" className="bg-ui-bg-subtle aspect-square w-full max-w-56 rounded-lg object-contain" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h1">{product.title}</Heading>
            <StatusBadge status={product.status ?? "draft"} />
          </div>
          {product.description && (
            <Text size="large" className="text-ui-fg-subtle line-clamp-4">
              {product.description}
            </Text>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="large"
              variant={published ? "secondary" : "primary"}
              className={TAP}
              isLoading={setStatus.isPending}
              onClick={() => setConfirm(true)}
            >
              {published ? "Take off sale" : "Put on sale"}
            </Button>
            {published && product.handle && (
              <a
                href={`https://${window.location.hostname.replace(/^admin\./, "")}/gb/products/${product.handle}`}
                target="_blank"
                rel="noreferrer"
                className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center underline-offset-2 hover:underline"
              >
                See it on the shop
              </a>
            )}
          </div>
          {error && (
            <Alert variant="error" role="alert">
              {error}
            </Alert>
          )}
        </div>
      </Container>

      <section aria-labelledby="price-stock" className="flex flex-col gap-2">
        <Heading level="h2" id="price-stock" className="px-1">
          Price and stock
        </Heading>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <VariantRowCard key={row.variant_id} row={row} />
          ))}
        </ul>
      </section>

      <a
        href={`/app/products/${product.id}`}
        className="txt-medium text-ui-fg-subtle inline-flex min-h-11 items-center self-start underline-offset-2 hover:underline"
      >
        Open in the full admin (description, photos, categories)
      </a>

      <ConfirmDialog
        open={confirm}
        title={published ? "Take this product off sale?" : "Put this product on sale?"}
        description={
          published
            ? "Customers won't see it or be able to buy it. You can put it back on sale at any time."
            : "Customers will see it on the shop and can buy it straight away."
        }
        confirmText={published ? "Take off sale" : "Put on sale"}
        onConfirm={() => {
          setConfirm(false)
          setStatus.mutate(published ? "draft" : "published")
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
