import { importFailureMessage } from "../import-errors"
import { ImportStoppedError } from "../import-parts"

/** What @medusajs/js-sdk throws for a non-2xx answer. */
class FetchError extends Error {
  constructor(message: string, public statusText?: string, public status?: number) {
    super(message)
  }
}

describe("importFailureMessage", () => {
  it("says the import may still be running when the request was cut off or never answered", () => {
    const expected = "The import may still be running. Check the product list before retrying."
    // The proxy gave up on the request (Cloudflare 524, gateway 502/504, 408).
    for (const status of [524, 504, 502, 408]) {
      const m = importFailureMessage(new FetchError("<html>timeout</html>", "Timeout", status))
      expect(m.title).toBe(expected)
      expect(m.description).toBe(
        "The server did not answer in time. Imported rows are not added twice if you import the same file again."
      )
    }
    // The browser lost the connection: fetch rejects with a TypeError and no status.
    const network = importFailureMessage(new TypeError("Failed to fetch"))
    expect(network.title).toBe(expected)
    expect(network.description).toMatch(/not added twice/)
  })

  it("says the import stopped part-way when the server wrote some chunks before a problem", () => {
    const message =
      "200 rows (lines 2 to 201) were imported before a problem stopped the import; the rows after them were not. " +
      "Charger X needs a safety marking. Fix the file and import it again: rows already imported are updated, not added twice."
    const m = importFailureMessage(new FetchError(message, "Bad Request", 400))
    expect(m.title).toBe("The import stopped part-way.")
    expect(m.description).toBe(message)
  })

  it("keeps the rows already imported in the message when a later part was cut off or lost", () => {
    const message =
      "600 rows (lines 2 to 601) were imported before a problem stopped the import; the rows after them were not. timeout"
    for (const cause of [new FetchError("<html>timeout</html>", "Timeout", 504), new TypeError("Failed to fetch")]) {
      const m = importFailureMessage(new ImportStoppedError(message, cause))
      expect(m.title).toBe("The import stopped part-way. Its last part may still be running.")
      expect(m.description).toContain("lines 2 to 601")
      expect(m.description).toMatch(/check the product list/i)
    }
  })

  it("says nothing was changed for an ordinary refusal", () => {
    const m = importFailureMessage(new FetchError("The file is empty.", "Bad Request", 400))
    expect(m).toEqual({ title: "The import didn't run. Nothing was changed.", description: "The file is empty." })
    expect(importFailureMessage(new FetchError("Unauthorized", "Unauthorized", 401)).title).toBe(
      "The import didn't run. Nothing was changed."
    )
    expect(importFailureMessage(new FetchError("boom", "Internal Server Error", 500)).title).toBe(
      "The import didn't run. Nothing was changed."
    )
  })

  it("copes with an error that is not an Error", () => {
    expect(importFailureMessage("nope")).toEqual({
      title: "The import didn't run. Nothing was changed.",
      description: undefined,
    })
  })
})
