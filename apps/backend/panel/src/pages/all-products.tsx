import { Badge, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { PageLoading, Pager, TAP, Thumb } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage } from "../../../src/admin/lib/format"
import { useDebounced } from "../../../src/admin/lib/use-debounced"

// Every product, newest first, with a search. A product opens its own page
// (photo, on sale or not, price and stock).

const PAGE_SIZE = 20

type Row = { id: string; title: string; status: string; thumbnail: string | null; variants?: { id: string }[] | null }

export function StatusBadge({ status }: { status: string }) {
  return status === "published" ? <Badge color="green">On sale</Badge> : <Badge color="grey">Not on sale</Badge>
}

export function AllProductsPage() {
  const [q, setQ] = useState("")
  const [offset, setOffset] = useState(0)
  const search = useDebounced(q.trim(), 300)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["panel", "products", search, offset],
    queryFn: () =>
      sdk.client.fetch<{ products: Row[]; count: number }>("/admin/products", {
        query: { q: search || undefined, limit: PAGE_SIZE, offset, order: "-created_at", fields: "id,title,status,thumbnail,variants.id" },
      }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">All products</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            Open a product to put it on sale, take it off, or change its price and stock.
          </Text>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-search" size="base" weight="plus">
            Search by name or code
          </Label>
          <Input
            id="product-search"
            type="search"
            size="base"
            className={TAP}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOffset(0)
            }}
          />
        </div>
      </Container>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <Container className="px-4 py-4">
          <Text size="large" role="alert">
            {errorMessage(error)}
          </Text>
        </Container>
      ) : !data?.products.length ? (
        <Container className="px-4 py-6">
          <Text size="large">{search ? "No product matches that search." : "No products yet. Add one on the Products page."}</Text>
        </Container>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.products.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/products/${p.id}`}
                  className="bg-ui-bg-component shadow-elevation-card-rest hover:bg-ui-bg-component-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-16 items-center gap-3 rounded-lg p-4 outline-none"
                >
                  <Thumb src={p.thumbnail} />
                  <span className="txt-large-plus min-w-0 flex-1 truncate">{p.title}</span>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pager offset={offset} limit={PAGE_SIZE} count={data.count} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
