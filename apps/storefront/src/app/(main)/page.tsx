import { Metadata } from "next"
import { STORE_COUNTRY } from "@lib/constants/store"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "Medusa Next.js Starter Template",
  description:
    "A performant frontend ecommerce starter template with Next.js 15 and Medusa.",
}

export default async function Home() {
  const [region, collections] = await Promise.all([
    getRegion(STORE_COUNTRY).catch(() => null),
    listCollections({ fields: "id, handle, title" })
      .then((res) => res.collections)
      .catch(() => null),
  ])

  if (!collections || !region) {
    return (
      <>
        <Hero />
        <p className="content-container py-12 text-center text-muted-foreground">
          We can&apos;t show products right now. Please try again in a moment.
        </p>
      </>
    )
  }

  return (
    <>
      <Hero />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
