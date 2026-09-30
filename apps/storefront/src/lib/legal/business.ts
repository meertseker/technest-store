import { siteConfig } from "@/lib/site-config"

/**
 * Facts the legal pages need that are not in the Google Business Profile.
 * Every null renders as a visible "to be confirmed" placeholder, and each one
 * is marked [LEAD?]. Fill them in here (or in siteConfig for the name and VAT
 * number) once the lead confirms them.
 */
export const legalDetails = {
  legalName: siteConfig.legalName,
  vatNumber: siteConfig.vatNumber,
  companyNumber: null as string | null, // [LEAD?] company number, or sole trader
  /** Registered office, if it differs from the shop address */
  registeredOffice: null as string | null, // [LEAD?]
  /** Never invent one: the Google profile has no email address */
  email: siteConfig.email,
  /** ICO data protection fee registration number */
  icoNumber: null as string | null, // [LEAD?]
}

/**
 * true while the lead has not signed off the wording. Draft pages show a
 * banner, are noindex and are left out of the sitemap.
 */
export const LEGAL_DRAFT = true

/** Shown as "Last updated" on every legal page */
export const LEGAL_LAST_UPDATED = "2026-09-30"
