import { describe, expect, it } from "vitest"
import data from "@/content/google-reviews.json"
import {
  approxReviewMonth,
  displayAuthor,
  MIN_REVIEW_CHARS,
  pickFeaturedReviews,
} from "./reviews"

describe("pickFeaturedReviews", () => {
  it("takes the newest reviews with at least 60 characters, text untouched", () => {
    const picked = pickFeaturedReviews(data.reviews, 3)
    expect(picked).toHaveLength(3)
    for (const r of picked) {
      expect(Array.from(r.text.trim()).length).toBeGreaterThanOrEqual(MIN_REVIEW_CHARS)
      const original = data.reviews.find((x) => x.id === r.id)!
      expect(r.text).toBe(original.text)
    }
    // file order is newest first, and nothing newer that qualifies was skipped
    const idx = picked.map((p) => data.reviews.findIndex((x) => x.id === p.id))
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    const skipped = data.reviews.slice(0, idx[idx.length - 1]).filter((r) => !picked.includes(r))
    for (const r of skipped) expect(Array.from(r.text.trim()).length).toBeLessThan(MIN_REVIEW_CHARS)
  })

  it("is a fixed rule: the current export gives Anna, Abolaji and Mike", () => {
    // Tinuola's review (2nd newest) is 39 characters, so it is skipped
    expect(pickFeaturedReviews(data.reviews, 3).map((r) => displayAuthor(r.author))).toEqual([
      "Anna K.",
      "Abolaji B.",
      "Mike J.",
    ])
  })

  it("skips rating-only and short reviews", () => {
    const r = pickFeaturedReviews(
      [
        { id: "a", author: "A", stars: 5, text: "", relative_date: "" },
        { id: "b", author: "B", stars: 5, text: "Great", relative_date: "" },
        { id: "c", author: "C", stars: 5, text: "x".repeat(60), relative_date: "" },
      ],
      3
    )
    expect(r.map((x) => x.id)).toEqual(["c"])
  })

  it("counts characters, not UTF-16 units (emoji count once) or edge whitespace", () => {
    const emoji = "⭐️" // the star emoji used in the export
    const star = "\u{1F31F}" // an astral emoji: 2 UTF-16 units, 1 character
    const r = pickFeaturedReviews(
      [
        { text: "x".repeat(58) + star },
        { text: "   " + "x".repeat(59) + "   " },
        { text: "x".repeat(58) + emoji },
      ],
      3
    )
    expect(r).toHaveLength(1)
    expect(r[0].text.endsWith(emoji)).toBe(true)
  })
})

describe("displayAuthor", () => {
  it("shows first name and last initial", () => {
    expect(displayAuthor("Anna Kmieciak (Anna K)")).toBe("Anna K.")
    expect(displayAuthor("Abolaji Bamidele-Alao")).toBe("Abolaji B.")
    expect(displayAuthor("Francisco J. Martin Navarro")).toBe("Francisco N.")
    expect(displayAuthor("Madonna")).toBe("Madonna")
  })
})

describe("approxReviewMonth", () => {
  it("turns Google's relative date into a month, relative to the export", () => {
    expect(approxReviewMonth("a week ago", "2026-09-29")).toBe("September 2026")
    expect(approxReviewMonth("2 weeks ago", "2026-09-29")).toBe("September 2026")
    expect(approxReviewMonth("a month ago", "2026-09-29")).toBe("August 2026")
    expect(approxReviewMonth("3 months ago", "2026-09-29")).toBe("June 2026")
    expect(approxReviewMonth("2 years ago", "2026-09-29")).toBe("September 2024")
    expect(approxReviewMonth("5 days ago", "2026-09-03")).toBe("August 2026")
  })
  it("returns null for anything it doesn't understand", () => {
    expect(approxReviewMonth("Edited 2 weeks ago", "2026-09-29")).toBeNull()
    expect(approxReviewMonth("a week ago", "not a date")).toBeNull()
  })
  it("understands every date in the current export", () => {
    for (const r of data.reviews) {
      expect(approxReviewMonth(r.relative_date, data.collected_at), r.relative_date).not.toBeNull()
    }
  })
})
