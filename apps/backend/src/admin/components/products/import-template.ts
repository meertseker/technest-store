import { toCsv } from "../../../lib/product-import/csv"
import { IMPORT_COLUMNS, ImportColumn } from "../../../lib/product-import/rows"

/**
 * The downloadable CSV template: the header plus three example rows. Written
 * with `toCsv`, so no cell can run as a spreadsheet formula (= + - @).
 * Kept in sync with the importer by src/lib/product-import/__tests__/template.unit.spec.ts.
 */
export const IMPORT_TEMPLATE_FILENAME = "tech-nest-import-template.csv"

const EXAMPLES: Partial<Record<ImportColumn, string>>[] = [
  {
    sku: "TN-CASE-IP16-CLR",
    title: "Clear Shockproof Case iPhone 16",
    description: "Slim, clear case with raised edges.",
    category: "cases",
    price_gbp: "6.99",
    status: "published",
    stock: "15",
    reorder_level: "3",
    device_slugs: "iphone-16",
    is_addon_item: "no",
    warranty_months: "6",
  },
  {
    sku: "TN-CBL-CC-1M",
    title: "USB-C to USB-C Cable 1m",
    description: "Braided 60W cable.",
    category: "chargers-cables",
    price_gbp: "4.99",
    status: "published",
    stock: "40",
    reorder_level: "10",
    connector_a: "USB-C",
    connector_b: "USB-C",
    wattage: "60",
    cable_length_m: "1",
    is_addon_item: "no",
    safety_marking: "UKCA",
    warranty_months: "12",
  },
  {
    sku: "TN-ADD-GRIP",
    title: "Phone Grip Ring",
    description: "Stick-on metal ring grip.",
    category: "1-deals",
    price_gbp: "1.00",
    status: "published",
    stock: "100",
    reorder_level: "20",
    is_addon_item: "yes",
  },
]

export const IMPORT_TEMPLATE_CSV = toCsv([
  [...IMPORT_COLUMNS],
  ...EXAMPLES.map((row) => IMPORT_COLUMNS.map((col) => row[col] ?? "")),
])
