import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowUpTray } from "@medusajs/icons"
import { Alert, Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/client"
import { IMPORT_TEMPLATE_CSV, IMPORT_TEMPLATE_FILENAME } from "./template"
import { ImportPlan, ImportResponse, PreviewResponse, PreviewRow } from "./types"

type Filter = "all" | "problems" | "warnings"

// Bigger than the ~1.5 MB a 2000-row stock list needs, well under the server limit.
const MAX_FILE_BYTES = 1_900_000

function downloadTemplate() {
  const blob = new Blob([IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = IMPORT_TEMPLATE_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function ActionBadge({ row }: { row: PreviewRow }) {
  if (row.action === "error") return <Badge color="red">Problem</Badge>
  if (row.action === "create") return <Badge color="blue">New</Badge>
  return <Badge color="grey">Update</Badge>
}

function RowCard({ row }: { row: PreviewRow }) {
  return (
    <li className="flex flex-col gap-y-2 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <ActionBadge row={row} />
        {row.status === "draft" && <Badge color="orange">Draft</Badge>}
        {row.status === "published" && <Badge color="green">Live</Badge>}
        <Text size="small" className="text-ui-fg-subtle">
          Line {row.line} · SKU {row.sku || "(empty)"}
        </Text>
      </div>
      <Text size="large" weight="plus" className="break-words">
        {row.title || "(no title)"}
      </Text>
      {row.errors.length > 0 && (
        <ul className="flex flex-col gap-y-1" aria-label={`Problems on line ${row.line}`}>
          {row.errors.map((e) => (
            <li key={e}>
              <Text size="large" className="text-ui-fg-error">
                {e}
              </Text>
            </li>
          ))}
        </ul>
      )}
      {row.warnings.length > 0 && (
        <ul className="flex flex-col gap-y-1" aria-label={`Warnings on line ${row.line}`}>
          {row.warnings.map((w) => (
            <li key={w}>
              <Text size="large" className="text-ui-tag-orange-text">
                {w}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "secondary"}
      aria-pressed={active}
      onClick={onClick}
      className="min-h-11"
    >
      {children}
    </Button>
  )
}

const ImportProductsPage = () => {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [csv, setCsv] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [done, setDone] = useState<ImportResponse | null>(null)
  const [filter, setFilter] = useState<Filter>("all")

  const preview = useMutation({
    mutationFn: (text: string) =>
      sdk.client.fetch<PreviewResponse>("/admin/product-import/preview", {
        method: "POST",
        body: { csv: text },
      }),
    onSuccess: ({ plan }) => {
      setPlan(plan)
      setFilter(plan.summary.error > 0 ? "problems" : "all")
    },
  })

  const commit = useMutation({
    mutationFn: (text: string) =>
      sdk.client.fetch<ImportResponse>("/admin/product-import", {
        method: "POST",
        body: { csv: text },
      }),
    onSuccess: (result) => {
      setDone(result)
      setPlan(result.plan)
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product"] })
      toast.success(
        `Import finished: ${result.created} added, ${result.updated} updated.`
      )
    },
    // The Import button is at the bottom of a long list; the message at the top is out of sight.
    onError: (error: Error) => {
      toast.error("The import didn't run. Nothing was changed.", { description: error.message })
    },
  })

  // Move focus to the result so screen readers and keyboard users land on it.
  useEffect(() => {
    if (plan || done) summaryRef.current?.focus()
  }, [plan, done])

  const reset = () => {
    setCsv(null)
    setFileName(null)
    setFileProblem(null)
    setPlan(null)
    setDone(null)
    preview.reset()
    commit.reset()
    if (fileInput.current) fileInput.current.value = ""
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    reset()
    setFileName(file.name)
    if (file.size > MAX_FILE_BYTES) {
      setFileProblem("This file is too big. Split it into files of up to 2000 rows.")
      return
    }
    const text = await file.text()
    setCsv(text)
    preview.mutate(text)
  }

  const rows = plan?.rows ?? []
  const shown = rows.filter((r) =>
    filter === "problems"
      ? r.errors.length > 0
      : filter === "warnings"
        ? r.warnings.length > 0
        : true
  )
  const importable = plan && !plan.file_errors.length ? plan.summary.create + plan.summary.update : 0
  const requestError = (preview.error ?? commit.error) as Error | null

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-2 px-4 py-4 md:px-6">
        <Heading level="h1">Import products</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Add or update many products from a spreadsheet saved as CSV. Rows are matched by SKU:
          a SKU we already have is updated, a new SKU becomes a new product. Nothing changes until
          you press Import.
        </Text>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row md:px-6">
        <input
          ref={fileInput}
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onFile}
        />
        <Button
          type="button"
          size="large"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => fileInput.current?.click()}
          isLoading={preview.isPending}
          disabled={preview.isPending || commit.isPending}
        >
          {csv ? "Choose another CSV file" : "Choose CSV file"}
        </Button>
        <Button
          type="button"
          size="large"
          variant="secondary"
          className="min-h-11 w-full sm:w-auto"
          onClick={downloadTemplate}
        >
          Download template
        </Button>
      </div>

      {fileName && (
        <div className="px-4 py-3 md:px-6">
          <Text size="large">
            File:{" "}
            <Text as="span" size="large" weight="plus" className="break-all">
              {fileName}
            </Text>
          </Text>
          {preview.isPending && (
            <Text size="large" className="text-ui-fg-subtle" role="status">
              Checking your file…
            </Text>
          )}
        </div>
      )}

      {(fileProblem || requestError) && (
        <div className="px-4 py-4 md:px-6">
          <Alert variant="error" role="alert">
            {fileProblem ?? requestError?.message ?? "Something went wrong. Try again."}
          </Alert>
        </div>
      )}

      {plan && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          className="flex flex-col gap-y-3 px-4 py-4 outline-none md:px-6"
          aria-live="polite"
        >
          {done ? (
            <Alert variant="success">
              Done. {plural(done.created, "product")} added, {plural(done.updated, "product")}{" "}
              updated
              {done.skipped ? `, ${plural(done.skipped, "row")} skipped because of problems` : ""}
              . <Link to="/products" className="underline">See products</Link>
            </Alert>
          ) : plan.file_errors.length ? (
            <Alert variant="error" role="alert">
              This file can't be imported: {plan.file_errors.join(" ")}
            </Alert>
          ) : (
            <Text size="large" weight="plus">
              Check before importing: {plural(plan.summary.create, "new product")},{" "}
              {plural(plan.summary.update, "update")}
              {plan.summary.error ? `, ${plural(plan.summary.error, "row")} with problems` : ""}
              {plan.summary.draft ? `, ${plural(plan.summary.draft, "draft")}` : ""}.
            </Text>
          )}
          {plan.file_warnings.map((w) => (
            <Alert key={w} variant="warning">
              {w}
            </Alert>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div
            className="flex flex-wrap gap-2 px-4 py-3 md:px-6"
            role="group"
            aria-label="Show rows"
          >
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              {`All (${rows.length})`}
            </FilterButton>
            <FilterButton active={filter === "problems"} onClick={() => setFilter("problems")}>
              {`Problems (${plan!.summary.error})`}
            </FilterButton>
            <FilterButton active={filter === "warnings"} onClick={() => setFilter("warnings")}>
              {`Warnings (${plan!.summary.with_warnings})`}
            </FilterButton>
          </div>
          {shown.length ? (
            <ul className="divide-y" aria-label="Rows in the file">
              {shown.map((row) => (
                <RowCard key={row.line} row={row} />
              ))}
            </ul>
          ) : (
            <Text size="large" className="px-4 py-4 text-ui-fg-subtle md:px-6">
              No rows here.
            </Text>
          )}
        </>
      )}

      {plan && !done && importable > 0 && (
        <div className="bg-ui-bg-base sticky bottom-0 flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center md:px-6">
          <Button
            type="button"
            size="large"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => csv && commit.mutate(csv)}
            isLoading={commit.isPending}
            disabled={commit.isPending}
          >
            {`Import ${plural(importable, "product")}`}
          </Button>
          {plan.summary.error > 0 && (
            <Text size="large" className="text-ui-fg-subtle">
              {plural(plan.summary.error, "row")} with problems will be skipped. Fix them and import
              the file again later; nothing is added twice.
            </Text>
          )}
        </div>
      )}

      {done && (
        <div className="px-4 py-4 md:px-6">
          <Button
            type="button"
            size="large"
            variant="secondary"
            className="min-h-11 w-full sm:w-auto"
            onClick={reset}
          >
            Import another file
          </Button>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Import products",
  icon: ArrowUpTray,
  rank: 5,
})

export default ImportProductsPage
