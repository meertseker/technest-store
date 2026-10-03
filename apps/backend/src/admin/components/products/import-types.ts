// Response shapes of /admin/product-import (see src/lib/product-import/plan.ts).

export type PreviewRow = {
  line: number
  sku: string
  title: string
  action: "create" | "update" | "error"
  status: "draft" | "published" | null
  errors: string[]
  warnings: string[]
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
  }
}

export type PreviewResponse = { plan: ImportPlan }

export type ImportResponse = {
  plan: ImportPlan
  created: number
  updated: number
  skipped: number
}
