// Response shapes of /admin/product-import (see src/lib/product-import/plan.ts).

export type PreviewRow = {
  line: number
  sku: string
  title: string
  action: "create" | "update" | "error"
  status: "draft" | "published" | null
  errors: string[]
  warnings: string[]
  /** An existing draft that stays a draft because the status column is blank. */
  existing_draft_kept: boolean
}

export type ImportPlan = {
  file_errors: string[]
  file_warnings: string[]
  rows: PreviewRow[]
  summary: {
    rows: number
    create: number
    update: number
    error: number
    with_warnings: number
    draft: number
    /** Rows that keep an existing draft because their status column is blank. */
    existing_drafts_kept: number
  }
}

export type PreviewResponse = { plan: ImportPlan }

export type ImportResponse = {
  plan: ImportPlan
  created: number
  updated: number
  skipped: number
  /** One entry per server-side run: a big file is written in chunks of 200 rows. */
  chunks: { rows: number; lines: { from: number; to: number }; created: number; updated: number }[]
  /** Set when the request asked for one part of the file (what this page does). */
  part?: { index: number; count: number; lines: { from: number; to: number } }
}
