import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getCurrentDevice, listProductDevices } from "@lib/data/devices"
import {
  getProductByHandle,
  listAllCategories,
  listCategoryProducts,
  listDeviceProductIds,
} from "@lib/data/catalogue"
import { getTechnestSettings } from "@lib/data/technest-settings"
import { getBaseURL } from "@lib/util/env"
import { plainEnglish, readAttributes, specRows } from "@/lib/catalogue/attributes"
import { iconKeyFor } from "@/lib/catalogue/category-icon"
import { ancestry, categoryPath, descendantIds } from "@/lib/catalogue/categories"
import { deliveryLines, freeDeliveryThresholdPence, toPence } from "@/lib/catalogue/delivery"
import { fitResult } from "@/lib/catalogue/fit"
import { breadcrumbJsonLd, productJsonLd, type Crumb } from "@/lib/catalogue/json-ld"
import { pickRelated } from "@/lib/catalogue/related"
import { initialSelection, priceRange } from "@/lib/catalogue/variants"
import { pickerHref } from "@/lib/devices/cookie"
import { deviceHref } from "@/lib/devices/tree"
import { JsonLd } from "@/lib/seo/json-ld"
import { formatTime, getOpenStatus } from "@/lib/site-config"
import Breadcrumbs from "@modules/catalogue/components/breadcrumbs"
import ProductGrid from "@modules/catalogue/components/product-grid"
import BuyBox from "@modules/catalogue/pdp/buy-box"
import Gallery from "@modules/catalogue/pdp/gallery"
import { Accordion, DeliveryBox, FitBox, Specs, type FitStatus } from "@modules/catalogue/pdp/parts"

type Props = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ v_id?: string | string[] }>
}

const load = async (handle: string) => {
  const product = await getProductByHandle(handle)
  if (!product) notFound()
  return product
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { handle } = await props.params
  const product = await load(handle)
  const description =
    product.description?.slice(0, 160) ||
    `${product.title} from Tech Nest, Southwark Park Road, London SE16. Free Click & Collect.`
  return {
    title: product.title,
    description,
    alternates: { canonical: `/p/${product.handle}` },
    openGraph: {
      title: product.title,
      description,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

/** "8pm" when the shop is open (or still to open) later today, else null */
function closesToday(now: Date) {
  const { open, today } = getOpenStatus(now)
  if (!today.closes) return null
  const london = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now)
  return open || (today.opens && london < today.opens) ? formatTime(today.closes) : null
}

export default async function ProductPage(props: Props) {
  const [{ handle }, sp] = await Promise.all([props.params, props.searchParams])
  const product = await load(handle)
  const vId = Array.isArray(sp.v_id) ? sp.v_id[0] : sp.v_id

  const [categories, device, linked, settings] = await Promise.all([
    listAllCategories().catch(() => []),
    getCurrentDevice().catch(() => null),
    listProductDevices(product.id),
    getTechnestSettings(),
  ])

  // Breadcrumbs follow the product's deepest category
  const own = (product.categories ?? [])
    .map((c) => categories.find((x) => x.id === c.id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => ancestry(categories, b).length - ancestry(categories, a).length)[0]
  const chain = own ? ancestry(categories, own) : []
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    ...chain.map((c) => ({ name: c.name, path: categoryPath(categories, c) })),
    { name: product.title, path: `/p/${product.handle}` },
  ]

  // "Goes well with this": the same top-level category, device fits first
  const [sameRange, fitIds] = await Promise.all([
    chain.length
      ? listCategoryProducts(descendantIds(categories, chain[0].id))
          .then((r) => r.products)
          .catch(() => [])
      : [],
    device ? listDeviceProductIds(device.slug).catch(() => null) : null,
  ])
  const goesWith = pickRelated(product, sameRange, { fitIds })

  const path = `/p/${product.handle}`
  const fit = fitResult(device, linked)
  const fitStatus: FitStatus =
    fit.kind === "doesnt-fit"
      ? {
          kind: "doesnt-fit",
          device: fit.device,
          seeHref: own ? categoryPath(categories, own) : device ? deviceHref(device) : "/search",
        }
      : fit.kind === "choose"
        ? { kind: "choose", pickerHref: pickerHref(path) }
        : fit

  const attrs = readAttributes(product)
  const range = priceRange(product)
  const lines = deliveryLines({
    thresholdPence: freeDeliveryThresholdPence(settings),
    closesToday: closesToday(new Date()),
    itemPricePence: range ? toPence(range.min) : null,
  })
  const images = (product.images ?? []).map((i) => ({ id: i.id, url: i.url }))
  if (!images.length && product.thumbnail) images.push({ id: "thumb", url: product.thumbnail })
  const base = getBaseURL()

  return (
    <div className="content-container pb-28 lg:pb-12">
      <JsonLd data={productJsonLd(base, product)} />
      <JsonLd data={breadcrumbJsonLd(base, crumbs)} />
      <Breadcrumbs crumbs={crumbs} />

      <div className="mt-2 lg:mt-4 lg:grid lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <Gallery
            images={images}
            title={product.title}
            placeholderIcon={iconKeyFor(product.title, ...chain.map((c) => c.handle).reverse())}
          />
        </div>
        <div className="mt-6 lg:sticky lg:top-[calc(var(--header-stack)+24px)] lg:col-span-5 lg:mt-0 lg:self-start">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
            {product.title}
          </h1>
          {product.subtitle && <p className="mt-1 text-lg text-muted-foreground">{product.subtitle}</p>}
          <BuyBox
            product={{
              id: product.id,
              title: product.title,
              options: (product.options ?? []).map((o) => ({ id: o.id, title: o.title })),
              variants: (product.variants ?? []).map((v) => ({
                id: v.id,
                sku: v.sku,
                manage_inventory: v.manage_inventory,
                allow_backorder: v.allow_backorder,
                inventory_quantity: v.inventory_quantity,
                options: (v.options ?? []).map((o) => ({ option_id: o.option_id, value: o.value })),
                calculated_price: v.calculated_price
                  ? {
                      calculated_amount: v.calculated_price.calculated_amount,
                      original_amount: v.calculated_price.original_amount,
                    }
                  : null,
              })),
            }}
            initial={initialSelection(product, { variantId: vId, deviceModel: device?.model })}
            fitBox={<FitBox status={fitStatus} />}
            addOnNote={attrs.is_addon_item}
          />
          <DeliveryBox lines={lines} fallbackNote />
        </div>
      </div>

      <div className="mt-10 border-t border-border lg:mt-16">
        {product.description && (
          <Accordion title="About this product" open>
            <p className="max-w-[68ch] whitespace-pre-line">{product.description}</p>
          </Accordion>
        )}
        <Accordion title="Specifications">
          <Specs summary={plainEnglish(attrs)} rows={specRows(attrs)} devices={linked} />
        </Accordion>
        <Accordion title="Returns and warranty">
          <div className="max-w-[68ch] space-y-3">
            <p>
              Changed your mind? You can return most items within 14 days of receiving them, by
              post or at our shop.{" "}
              {attrs.warranty_months !== null &&
                `This item comes with a ${attrs.warranty_months}-month warranty. `}
              Faulty items are covered by your legal rights as well.
            </p>
            <p>
              <Link
                href="/legal/returns"
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                Read our returns policy
              </Link>
            </p>
          </div>
        </Accordion>
      </div>

      {goesWith.length >= 2 && (
        <section aria-labelledby="goes-with" className="mt-12 lg:mt-16">
          <h2 id="goes-with" className="text-[22px] font-semibold leading-tight lg:text-[28px]">
            Goes well with this
          </h2>
          <div className="mt-6">
            <ProductGrid
              products={goesWith}
              fitIds={fitIds ? goesWith.filter((p) => fitIds.has(p.id)).map((p) => p.id) : []}
              deviceLabel={device?.model}
            />
          </div>
        </section>
      )}
    </div>
  )
}
