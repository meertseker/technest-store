export type ParsedCsv = {
  /** Non-blank records, header first. */
  rows: string[][]
  /** The 1-based source line each record starts on (same order as `rows`). */
  lines: number[]
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
 * CRLF or LF, an optional BOM. Blank records are dropped.
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
    throw new Error(`A quote (") opened on line ${recordLine} is never closed.`)
  }
  endRecord()
  return { rows, lines }
}
