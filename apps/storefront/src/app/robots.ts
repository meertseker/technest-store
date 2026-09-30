import type { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"
import { PRIVATE_PATHS } from "@/lib/seo/sitemap"

export default function robots(): MetadataRoute.Robots {
  const base = getBaseURL().replace(/\/+$/, "")
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
