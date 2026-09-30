import { parseCsv, toCsv, toCsvCell, unescapeCsvCell } from "../csv"

describe("parseCsv", () => {
  it("parses a simple comma file with CRLF endings", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n3,4\r\n")
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ])
  })

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿sku,title\nA,B").rows[0]).toEqual(["sku", "title"])
  })

  it("handles quoted cells with commas, newlines and doubled quotes", () => {
    const { rows } = parseCsv('sku,description\nA,"Fits 6.1"", slim\nsecond line"\n')
    expect(rows[1]).toEqual(["A", 'Fits 6.1", slim\nsecond line'])
  })

  it("detects semicolon and tab delimiters from the header line", () => {
    expect(parseCsv("sku;title\nA;B, C").rows[1]).toEqual(["A", "B, C"])
    expect(parseCsv("sku\ttitle\nA\tB").rows[1]).toEqual(["A", "B"])
  })

  it("skips fully blank lines (Excel adds trailing ,,,, rows)", () => {
    const { rows } = parseCsv("a,b\n1,2\n\n,\n ,  \n")
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("keeps the source line number of each row", () => {
    const { lines } = parseCsv('a,b\n\n"x\ny",2\n3,4')
    expect(lines).toEqual([1, 3, 5])
  })

  it("reports an unterminated quote", () => {
    expect(parseCsv('a,b\n"oops,1')).toEqual({
      rows: [],
      lines: [],
      error: expect.stringMatching(/quote/i),
    })
  })
})

describe("toCsv / toCsvCell", () => {
  it("neutralises cells a spreadsheet would run as a formula", () => {
    expect(toCsvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"')
    expect(toCsvCell("+44 20")).toBe("'+44 20")
    expect(toCsvCell("-1")).toBe("'-1")
    expect(toCsvCell("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(toCsvCell("\tcmd")).toBe("\"'\tcmd\"")
    expect(toCsvCell("USB-C")).toBe("USB-C")
  })

  it("quotes delimiters, quotes and line breaks, and round-trips through parseCsv", () => {
    const records = [
      ["sku", "description"],
      ["A", 'Fits 6.1", slim; clear\nsecond line'],
      ["B", "=1+1"],
    ]
    const text = toCsv(records)
    expect(text.endsWith("\r\n")).toBe(true)
    const { rows } = parseCsv(text)
    expect(rows[1]).toEqual(records[1])
    expect(rows[2]).toEqual(["B", "'=1+1"])
    expect(unescapeCsvCell(rows[2][1])).toBe("=1+1")
  })

  it("writes null and undefined as empty cells", () => {
    expect(toCsv([["a", null, undefined, 3, true]])).toBe("a,,,3,true\r\n")
  })
})
