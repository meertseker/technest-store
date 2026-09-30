import type { ReactNode } from "react"

export type LegalSection = {
  /** anchor id, kebab-case */
  id: string
  heading: string
  body: ReactNode
}

export type LegalContent = {
  /** one or two plain-English sentences shown above the contents list */
  summary: ReactNode
  sections: LegalSection[]
}

/** Owner-editable values the wording depends on (admin settings), already formatted */
export type LegalContext = {
  /** e.g. "£20"; null when the settings route is unavailable */
  freeDeliveryThreshold: string | null
  /** e.g. "£30"; null when the settings route is unavailable */
  klarnaMinimum: string | null
  /** Server-rendered cookie choice control, slotted into the cookie policy */
  cookieSettings?: ReactNode
}

export type LegalContentFn = (ctx: LegalContext) => LegalContent
