export type ParsedCsv = {
  /** Non-blank records, header first. */
  rows: string[][]
  /** The 1-based source line each record starts on (same order as `rows`). */
  lines: number[]
  /** Set when the file can't be read (an unclosed quote); `rows` is then empty. */
  error?: string
}

const DELIMITERS = [",", ";", "\t"] as const

/** Picks the delimiter that splits the header line into the most cells (Excel may save with ; or tabs). */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  let best = ","
  let bestCount = 0
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length - 1
    if (count > bestCount) {
      best = d
      bestCount = count
    }
  }
  return best
}

/**
 * A small RFC 4180 CSV reader: quoted cells, doubled quotes, embedded newlines,
 * CRLF or LF, an optional BOM. Blank records are dropped. A broken file is
 * reported in `error` (not thrown: this file is also bundled into the admin).
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  const lines: number[] = []

  let record: string[] = []
  let cell = ""
  let inQuotes = false
  let line = 1
  let recordLine = 1

  const endRecord = () => {
    record.push(cell)
    if (record.some((c) => c.trim() !== "")) {
      rows.push(record)
      lines.push(recordLine)
    }
    record = []
    cell = ""
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        if (ch === "\n") line++
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell.trim() === "") {
      cell = ""
      inQuotes = true
    } else if (ch === delimiter) {
      record.push(cell)
      cell = ""
    } else if (ch === "\r" && text[i + 1] === "\n") {
      // handled by the \n branch
    } else if (ch === "\n" || ch === "\r") {
      endRecord()
      line++
      recordLine = line
    } else {
      cell += ch
    }
  }
  if (inQuotes) {
    return {
      rows: [],
      lines: [],
      error: `A quote (") opened on line ${recordLine} is never closed.`,
    }
  }
  endRecord()
  return { rows, lines }
}

/**
 * Cells a spreadsheet would run as a formula (CSV injection): = + - @, and tab or
 * carriage return, which some spreadsheets strip before reading the rest.
 */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One cell for a CSV file we hand to people: a leading formula character gets an
 * apostrophe (the spreadsheet then shows the text as-is), and cells with a
 * delimiter, quote or line break are quoted.
 */
export function toCsvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",;\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** A whole CSV file (comma separated, CRLF line endings, as Excel writes it). */
export function toCsv(records: (string | number | boolean | null | undefined)[][]): string {
  return records.map((record) => record.map(toCsvCell).join(",")).join("\r\n") + "\r\n"
}

/**
 * Undoes `toCsvCell`'s apostrophe when a file we wrote comes back: "'=x" reads as "=x".
 * Other leading apostrophes are kept.
 */
export function unescapeCsvCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value
}
