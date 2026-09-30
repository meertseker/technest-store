import {
  PLATFORMS,
  Platform,
  ProductAttributesValues,
  SafetyMarking,
} from "../../modules/product-attributes/utils"
import { parseCsv } from "./csv"

/** Most rows one import may contain (keeps one workflow run a sensible size). */
export const MAX_IMPORT_ROWS = 2000

/** Columns the importer reads, in template order. */
export const IMPORT_COLUMNS = [
  "sku",
  "title",
  "handle",
  "description",
  "category",
  "price_gbp",
  "status",
  "stock",
  "reorder_level",
  "device_slugs",
  "connector_a",
  "connector_b",
  "wattage",
  "cable_length_m",
  "platform",
  "is_addon_item",
  "safety_marking",
  "warranty_months",
] as const
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

/** Friendly header spellings people type in a spreadsheet. */
const HEADER_ALIASES: Record<string, ImportColumn> = {
  price: "price_gbp",
  devices: "device_slugs",
  device: "device_slugs",
  quantity: "stock",
  qty: "stock",
  addon: "is_addon_item",
  add_on: "is_addon_item",
  add_on_item: "is_addon_item",
}

export type ImportStatus = "draft" | "published"

export type ImportAttributes = Partial<ProductAttributesValues>

/** One CSV row after cell-level parsing. Absent keys mean "blank in the file". */
export type ImportRowInput = {
  sku: string
  title?: string
  handle?: string
  description?: string
  category?: string
  /** GBP major units, VAT included (3.49 means £3.49). */
  price?: number
  status?: ImportStatus
  stock?: number
  device_slugs?: string[]
  attributes: ImportAttributes
}

export type ParsedRow = {
  /** 1-based line in the file (the header is line 1). */
  line: number
  input: ImportRowInput
  errors: string[]
  warnings: string[]
}

export type ReadRowsResult = {
  rows: ParsedRow[]
  /** Problems that stop the whole file (no rows are imported). */
  file_errors: string[]
  file_warnings: string[]
}

export function normalizeHeader(header: string): string {
  const key = header
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
  return HEADER_ALIASES[key] ?? key
}

const TRUE_WORDS = ["yes", "y", "true", "1"]
const FALSE_WORDS = ["no", "n", "false", "0"]

function splitList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[;|,]/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

/** Parses "3.49", "£3.49" or " 3 " as a number; commas as decimal separators are refused. */
function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/^[£�]/, "").trim()
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

function parseWholeNumber(raw: string): number | null {
  const n = parseNumber(raw)
  return n !== null && Number.isInteger(n) ? n : null
}

type Cells = Partial<Record<ImportColumn, string>>

/** Turns one record's cells into typed values, collecting readable errors. */
export function parseRowCells(cells: Cells): {
  input: ImportRowInput
  errors: string[]
} {
  const errors: string[] = []
  const get = (col: ImportColumn) => (cells[col] ?? "").trim()
  const input: ImportRowInput = { sku: get("sku"), attributes: {} }

  if (!input.sku) {
    errors.push("SKU is empty. Every row needs a SKU.")
  }

  for (const col of ["title", "handle", "description", "category"] as const) {
    const v = get(col)
    if (v) input[col] = v
  }
  if (input.handle && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.handle)) {
    errors.push(
      `Handle "${input.handle}" can only use lowercase letters, numbers and dashes (for example "usb-c-cable-1m").`
    )
  }

  const price = get("price_gbp")
  if (price) {
    const n = parseNumber(price)
    const decimals = price.split(".")[1] ?? ""
    if (n === null || n <= 0 || decimals.length > 2) {
      errors.push(
        `Price "${price}" isn't a valid price. Use pounds with a dot, like 3.49 (VAT included).`
      )
    } else {
      input.price = n
    }
  }

  const status = get("status").toLowerCase()
  if (status) {
    if (status === "draft" || status === "published") {
      input.status = status
    } else {
      errors.push(`Status "${get("status")}" must be "published" or "draft".`)
    }
  }

  const stock = get("stock")
  if (stock) {
    const n = parseWholeNumber(stock)
    if (n === null) {
      errors.push(`Stock "${stock}" must be a whole number, 0 or more.`)
    } else {
      input.stock = n
    }
  }

  const devices = get("device_slugs")
  if (devices) input.device_slugs = splitList(devices)

  const attrs = input.attributes
  for (const col of ["connector_a", "connector_b"] as const) {
    const v = get(col)
    if (v) attrs[col] = v
  }
  for (const col of ["wattage", "cable_length_m"] as const) {
    const v = get(col)
    if (!v) continue
    const n = parseNumber(v)
    if (n === null) {
      errors.push(`${col === "wattage" ? "Wattage" : "Cable length"} "${v}" must be a number, like 20 or 1.5.`)
    } else {
      attrs[col] = n
    }
  }
  for (const col of ["warranty_months", "reorder_level"] as const) {
    const v = get(col)
    if (!v) continue
    const n = parseWholeNumber(v)
    if (n === null) {
      errors.push(
        `${col === "reorder_level" ? "Reorder level" : "Warranty months"} "${v}" must be a whole number, 0 or more.`
      )
    } else {
      attrs[col] = n
    }
  }

  const platform = get("platform")
  if (platform) {
    const values = splitList(platform)
    const unknown = values.filter((p) => !(PLATFORMS as readonly string[]).includes(p))
    if (unknown.length) {
      errors.push(
        `Platform "${unknown.join(", ")}" isn't known. Use: ${PLATFORMS.join(", ")}.`
      )
    } else {
      attrs.platform = values as Platform[]
    }
  }

  const addon = get("is_addon_item").toLowerCase()
  if (addon) {
    if (TRUE_WORDS.includes(addon)) attrs.is_addon_item = true
    else if (FALSE_WORDS.includes(addon)) attrs.is_addon_item = false
    else errors.push(`Add-on item "${get("is_addon_item")}" must be yes or no.`)
  }

  const marking = get("safety_marking").replace(/\s+/g, "").toUpperCase()
  if (marking) {
    if (marking === "UKCA" || marking === "CE") attrs.safety_marking = marking
    else if (marking === "NONE") attrs.safety_marking = "none" as SafetyMarking
    else
      errors.push(
        `Safety marking "${get("safety_marking")}" must be UKCA, CE or none.`
      )
  }

  return { input, errors }
}

/** Reads the CSV text into rows with cell-level errors. No database access. */
export function readImportRows(csv: string): ReadRowsResult {
  const file_errors: string[] = []
  const file_warnings: string[] = []

  let parsed
  try {
    parsed = parseCsv(csv)
  } catch (e) {
    return { rows: [], file_errors: [(e as Error).message], file_warnings }
  }
  const [header, ...records] = parsed.rows
  if (!header) {
    return { rows: [], file_errors: ["The file is empty."], file_warnings }
  }

  const columns = header.map(normalizeHeader)
  const known = new Set<string>(IMPORT_COLUMNS)
  const ignored = header.filter((_, i) => !known.has(columns[i]))
  if (ignored.length) {
    file_warnings.push(`These columns are ignored: ${ignored.join(", ")}.`)
  }
  const dup = columns.find((c, i) => known.has(c) && columns.indexOf(c) !== i)
  if (dup) file_errors.push(`The column "${dup}" appears twice.`)
  if (!columns.includes("sku")) {
    file_errors.push('The file has no "sku" column. Download the template to see the columns.')
  }
  if (!records.length) file_errors.push("The file has a header but no product rows.")
  if (records.length > MAX_IMPORT_ROWS) {
    file_errors.push(
      `The file has ${records.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time (split the file).`
    )
  }
  if (file_errors.length) return { rows: [], file_errors, file_warnings }

  const rows = records.map((record, i) => {
    const cells: Cells = {}
    columns.forEach((col, c) => {
      if (known.has(col)) cells[col as ImportColumn] = record[c] ?? ""
    })
    const { input, errors } = parseRowCells(cells)
    return { line: parsed.lines[i + 1], input, errors, warnings: [] }
  })
  return { rows, file_errors, file_warnings }
}
