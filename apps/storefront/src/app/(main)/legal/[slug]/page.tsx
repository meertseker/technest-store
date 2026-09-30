import { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatPence, getTechnestSettings } from "@lib/data/technest-settings"
import { LEGAL_DRAFT } from "@/lib/legal/business"
import { getLegalPage, LEGAL_PAGES } from "@/lib/legal/pages"
import { LEGAL_CONTENT } from "@modules/legal/content"
import CookieSettings from "@modules/consent/cookie-settings"
import LegalPage from "@modules/legal/templates/legal-page"

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getLegalPage((await params).slug)
  if (!page) return {}
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/legal/${page.slug}` },
    // Drafts stay out of search results until the lead signs them off
    robots: LEGAL_DRAFT ? { index: false, follow: true } : undefined,
  }
}

export default async function LegalSlugPage({ params }: Props) {
  const page = getLegalPage((await params).slug)
  if (!page) notFound()

  const settings = await getTechnestSettings()
  const content = LEGAL_CONTENT[page.slug]({
    freeDeliveryThreshold: settings ? formatPence(settings.free_delivery_threshold_pence) : null,
    klarnaMinimum: settings ? formatPence(settings.klarna_min_basket_pence) : null,
    cookieSettings: page.slug === "cookies" ? <CookieSettings /> : undefined,
  })

  return <LegalPage slug={page.slug} title={page.title} content={content} />
}
