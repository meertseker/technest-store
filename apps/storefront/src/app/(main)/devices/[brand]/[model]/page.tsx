import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { ArrowRight, CircleCheck } from "lucide-react"
import { getDeviceSlugFromCookie } from "@lib/data/devices"
import { getDevice, listAllCategories, listDeviceProducts } from "@lib/data/catalogue"
import { getBaseURL } from "@lib/util/env"
import { buttonVariants } from "@/components/ui/button"
import { categoryPath } from "@/lib/catalogue/categories"
import { groupByCategory } from "@/lib/catalogue/group"
import { breadcrumbJsonLd, type Crumb } from "@/lib/catalogue/json-ld"
import { isDeviceSlug, PICKER_PATH } from "@/lib/devices/cookie"
import { brandSlug, deviceHref } from "@/lib/devices/tree"
import { JsonLd } from "@/lib/seo/json-ld"
import Breadcrumbs from "@modules/catalogue/components/breadcrumbs"
import ProductGrid from "@modules/catalogue/components/product-grid"

type Props = { params: Promise<{ brand: string; model: string }> }

async function load({ brand, model }: { brand: string; model: string }) {
  if (!isDeviceSlug(model)) notFound()
  const found = await getDevice(model)
  if (!found) notFound()
  // One URL per device: /devices/apple/iphone-16 (brand segment fixed up if wrong)
  if (brandSlug(found.device.brand) !== brand) permanentRedirect(deviceHref(found.device))
  return found
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { device } = await load(await props.params)
  return {
    title: `${device.model} accessories`,
    description: `Cases, screen protectors, chargers and more that fit the ${device.brand} ${device.model}. Free Click & Collect from Tech Nest, Southwark Park Road, London SE16.`,
    alternates: { canonical: deviceHref(device) },
  }
}

export default async function DevicePage(props: Props) {
  const { device } = await load(await props.params)
  const path = deviceHref(device)
  const [{ products }, categories, currentSlug] = await Promise.all([
    listDeviceProducts(device.slug),
    listAllCategories().catch(() => []),
    getDeviceSlugFromCookie(),
  ])
  const groups = groupByCategory(products, categories)
  const isCurrent = currentSlug === device.slug
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Devices", path: PICKER_PATH },
    { name: device.model, path },
  ]

  return (
    <div className="content-container pb-12">
      <JsonLd data={breadcrumbJsonLd(getBaseURL(), crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
          Accessories for {device.model}
        </h1>
        <p className="text-muted-foreground">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isCurrent ? (
          <p className="inline-flex min-h-11 items-center gap-2 rounded-full bg-success-subtle px-4 font-semibold text-success">
            <CircleCheck aria-hidden className="size-5" />
            This is your device
          </p>
        ) : (
          <form action="/api/device" method="post">
            <input type="hidden" name="returnTo" value={path} />
            <button
              type="submit"
              name="slug"
              value={device.slug}
              className={buttonVariants({ variant: "secondary" })}
            >
              Shop for my {device.model}
            </button>
          </form>
        )}
        <Link
          href={PICKER_PATH}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Choose a different device
        </Link>
      </div>

      {groups.length ? (
        groups.map((g) => {
          const id = `group-${g.category?.handle ?? "other"}`
          return (
            <section key={id} aria-labelledby={id} className="mt-12">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <h2 id={id} className="text-[22px] font-semibold leading-tight lg:text-[28px]">
                  {g.category?.name ?? "Other accessories"}
                </h2>
                {g.category && (
                  <Link
                    href={categoryPath(categories, g.category)}
                    className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4"
                  >
                    All {g.category.name.toLowerCase()}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                )}
              </div>
              <div className="mt-6">
                <ProductGrid products={g.products} />
              </div>
            </section>
          )
        })
      ) : (
        <div className="mt-8 rounded bg-surface p-6">
          <h2 className="text-[22px] font-semibold leading-tight">
            Nothing listed for {device.model} yet
          </h2>
          <p className="mt-2 max-w-prose">
            We may still have it in the shop. Call or visit us, or browse everything we sell.
          </p>
          <Link href="/search" className={`${buttonVariants({ variant: "secondary" })} mt-4`}>
            Browse all products
          </Link>
        </div>
      )}
    </div>
  )
}
