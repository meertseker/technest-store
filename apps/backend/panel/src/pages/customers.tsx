import { ArrowLeft, Envelope, Phone } from "@medusajs/icons"
import { Badge, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { DetailRow, FilterChips, PageLoading, Pager, TAP } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"
import { errorMessage, formatDate, formatPence, plural } from "../../../src/admin/lib/format"
import { toPence } from "../../../src/admin/lib/order-detail"
import { useDebounced } from "../../../src/admin/lib/use-debounced"
import { ORDER_ROW_FIELDS, type OrderRow, OrderRows } from "./all-orders"

// Customers: everyone who has an account or has ordered as a guest. A card per
// customer on a phone, a table from `lg`; a customer page with their orders.

const TRADE_GROUP_NAME = "Trade"
const PAGE_SIZE = 20

type Group = { id: string; name: string }
type Address = {
  id: string
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  company?: string | null
}
type Customer = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company_name?: string | null
  has_account: boolean
  created_at: string
  groups?: Group[] | null
  addresses?: Address[] | null
}

const nameOf = (c: Customer) => [c.first_name, c.last_name].filter(Boolean).join(" ")
const isTrade = (c: Customer) => (c.groups ?? []).some((g) => g.name === TRADE_GROUP_NAME)

function useTradeGroupId() {
  return useQuery({
    queryKey: ["panel", "trade-group"],
    queryFn: async () => {
      const { customer_groups } = await sdk.client.fetch<{ customer_groups: Group[] }>("/admin/customer-groups", {
        query: { q: TRADE_GROUP_NAME, fields: "id,name", limit: 10 },
      })
      return customer_groups.find((g) => g.name === TRADE_GROUP_NAME)?.id ?? null
    },
    staleTime: 60 * 60_000,
  })
}

function CustomerBadges({ c }: { c: Customer }) {
  return (
    <>
      {isTrade(c) && <Badge color="purple">Trade</Badge>}
      {c.has_account ? <Badge color="green">Account</Badge> : <Badge color="grey">Guest</Badge>}
    </>
  )
}

type Filter = "all" | "trade" | "account" | "guest"
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trade", label: "Trade" },
  { value: "account", label: "With an account" },
  { value: "guest", label: "Guests" },
]

export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const filter = (FILTERS.find((f) => f.value === params.get("show"))?.value ?? "all") as Filter
  const [q, setQ] = useState("")
  const [offset, setOffset] = useState(0)
  const search = useDebounced(q.trim(), 300)
  const { data: tradeGroupId } = useTradeGroupId()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["panel", "customers", search, filter, offset, tradeGroupId],
    enabled: filter !== "trade" || tradeGroupId !== undefined,
    queryFn: async () => {
      if (filter === "trade" && !tradeGroupId) return { customers: [] as Customer[], count: 0 }
      return sdk.client.fetch<{ customers: Customer[]; count: number }>("/admin/customers", {
        query: {
          q: search || undefined,
          limit: PAGE_SIZE,
          offset,
          order: "-created_at",
          has_account: filter === "account" ? true : filter === "guest" ? false : undefined,
          groups: filter === "trade" && tradeGroupId ? [tradeGroupId] : undefined,
          fields: "id,email,first_name,last_name,phone,company_name,has_account,created_at,*groups",
        },
      })
    },
    placeholderData: keepPreviousData,
  })

  const setFilter = (next: Filter) => {
    setOffset(0)
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === "all") p.delete("show")
        else p.set("show", next)
        return p
      },
      { replace: true }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <Heading level="h1">Customers</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Everyone who has ordered or made an account.
        </Text>
      </div>
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customer-search" size="base" weight="plus">
            Search by name, email or phone
          </Label>
          <Input
            id="customer-search"
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
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} label="Show" />
      </Container>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <Container className="px-4 py-4">
          <Text size="large" role="alert">
            {errorMessage(error)}
          </Text>
        </Container>
      ) : !data?.customers.length ? (
        <Container className="px-4 py-6">
          <Text size="large">{search ? "No customer matches that search." : "No customers here yet."}</Text>
        </Container>
      ) : (
        <>
          <Text size="small" className="text-ui-fg-subtle px-1" role="status">
            {plural(data.count, "customer")}
          </Text>
          <ul className="flex flex-col gap-2 lg:hidden">
            {data.customers.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/customers/${c.id}`}
                  className="press bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-1.5 rounded-lg p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#d6001c]"
                >
                  <span className="txt-large-plus truncate">{nameOf(c) || c.email}</span>
                  {nameOf(c) && <span className="txt-medium text-ui-fg-subtle truncate">{c.email}</span>}
                  <span className="flex flex-wrap items-center gap-1.5">
                    <CustomerBadges c={c} />
                    <span className="txt-small text-ui-fg-subtle">Since {formatDate(c.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="bg-ui-bg-component shadow-elevation-card-rest hidden overflow-hidden rounded-lg lg:block">
            <table className="w-full text-left">
              <thead className="txt-small-plus text-ui-fg-subtle border-ui-border-base border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Phone</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Since</th>
                </tr>
              </thead>
              <tbody className="txt-medium">
                {data.customers.map((c) => (
                  <tr key={c.id} className="border-ui-border-base hover:bg-ui-bg-component-hover relative border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="txt-medium-plus after:absolute after:inset-0 focus-visible:underline">
                        {nameOf(c) || "No name"}
                      </Link>
                    </td>
                    <td className="max-w-64 truncate px-4 py-3">{c.email}</td>
                    <td className="text-ui-fg-subtle px-4 py-3">{c.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1.5">
                        <CustomerBadges c={c} />
                      </span>
                    </td>
                    <td className="text-ui-fg-subtle px-4 py-3">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} limit={PAGE_SIZE} count={data.count} onChange={setOffset} />
        </>
      )}
    </div>
  )
}

export function CustomerPage() {
  const { id = "" } = useParams<{ id: string }>()
  const customer = useQuery({
    queryKey: ["panel", "customer", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ customer: Customer }>(`/admin/customers/${id}`, {
          query: { fields: "id,email,first_name,last_name,phone,company_name,has_account,created_at,*groups,*addresses" },
        })
      ).customer,
  })
  const orders = useQuery({
    queryKey: ["panel", "customer-orders", id],
    queryFn: () =>
      sdk.client.fetch<{ orders: OrderRow[]; count: number }>("/admin/orders", {
        query: { customer_id: id, limit: 50, order: "-created_at", fields: ORDER_ROW_FIELDS },
      }),
  })

  if (customer.isLoading) return <PageLoading />
  const c = customer.data
  if (customer.isError || !c) {
    return (
      <Container className="px-4 py-6">
        <Text size="large" role="alert">
          {errorMessage(customer.error, "Couldn't load this customer.")}
        </Text>
      </Container>
    )
  }

  const kept = (orders.data?.orders ?? []).filter((o) => o.status !== "canceled")
  const spent = kept.reduce((t, o) => t + toPence(o.original_total ?? o.total), 0)
  const phone = c.phone || c.addresses?.find((a) => a.phone)?.phone || null

  return (
    <div className="flex flex-col gap-4">
      <Link to="/customers" className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center gap-1 self-start">
        <ArrowLeft /> Customers
      </Link>

      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Heading level="h1" className="break-all">
            {nameOf(c) || c.email}
          </Heading>
          <CustomerBadges c={c} />
        </div>
        <Text size="large" className="text-ui-fg-subtle">
          Customer since {formatDate(c.created_at)}
          {orders.data ? ` · ${plural(kept.length, "order")} · ${formatPence(spent)} spent` : ""}
        </Text>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={`mailto:${c.email}`}
            className="press bg-ui-bg-component shadow-elevation-card-rest txt-large-plus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4"
          >
            <Envelope /> Email
          </a>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="press bg-ui-bg-component shadow-elevation-card-rest txt-large-plus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4"
            >
              <Phone /> Call
            </a>
          )}
        </div>
      </Container>

      <Container className="divide-y p-0">
        <Heading level="h2" className="px-4 py-3 md:px-6">
          Details
        </Heading>
        <DetailRow label="Email">
          <span className="txt-large break-all">{c.email}</span>
        </DetailRow>
        <DetailRow label="Phone">{phone || "Not given"}</DetailRow>
        {c.company_name && <DetailRow label="Company">{c.company_name}</DetailRow>}
        <DetailRow label="Trade account">
          {isTrade(c) ? (
            "Yes, sees trade prices"
          ) : (
            <Link to="/shop-orders?tab=trade" className="txt-large text-ui-fg-interactive underline-offset-2 hover:underline">
              No. See trade applications
            </Link>
          )}
        </DetailRow>
        {(c.addresses ?? []).map((a, i) => (
          <DetailRow key={a.id} label={i === 0 ? "Address" : `Address ${i + 1}`}>
            {[a.company, a.address_1, a.address_2, a.city, a.postal_code].filter(Boolean).join(", ") || "-"}
          </DetailRow>
        ))}
      </Container>

      <section aria-labelledby="customer-orders" className="flex flex-col gap-2">
        <Heading level="h2" id="customer-orders" className="px-1">
          Orders
        </Heading>
        {orders.isLoading ? (
          <PageLoading />
        ) : orders.isError ? (
          <Text size="large" role="alert">
            {errorMessage(orders.error)}
          </Text>
        ) : !orders.data?.orders.length ? (
          <Container className="px-4 py-6">
            <Text size="large">No orders yet.</Text>
          </Container>
        ) : (
          <OrderRows orders={orders.data.orders} />
        )}
      </section>
    </div>
  )
}
