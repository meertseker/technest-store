import type { LegalSlug } from "@/lib/legal/pages"
import type { LegalContentFn } from "@modules/legal/types"
import accessibility from "./accessibility"
import cookies from "./cookies"
import delivery from "./delivery"
import privacy from "./privacy"
import repairTerms from "./repair-terms"
import returns from "./returns"
import terms from "./terms"
import weee from "./weee"

/** Typed as a full Record so a page listed in LEGAL_PAGES can never lack content */
export const LEGAL_CONTENT: Record<LegalSlug, LegalContentFn> = {
  terms,
  delivery,
  returns,
  privacy,
  cookies,
  accessibility,
  weee,
  "repair-terms": repairTerms,
}
