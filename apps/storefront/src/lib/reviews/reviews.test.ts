import { describe, expect, it } from "vitest"
import data from "@/content/google-reviews.json"
import { displayAuthor, pickFeaturedReviews } from "./reviews"

describe("pickFeaturedReviews", () => {
  it("takes the newest reviews with at least 60 characters, text untouched", () => {
    const picked = pickFeaturedReviews(data.reviews, 3)
    expect(picked).toHaveLength(3)
    for (const r of picked) {
      expect(r.text.length).toBeGreaterThanOrEqual(60)
      const original = data.reviews.find((x) => x.id === r.id)!
      expect(r.text).toBe(original.text)
    }
    // file order is newest first
    const idx = picked.map((p) => data.reviews.findIndex((x) => x.id === p.id))
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
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
})

describe("displayAuthor", () => {
  it("shows first name and last initial", () => {
    expect(displayAuthor("Anna Kmieciak (Anna K)")).toBe("Anna K.")
    expect(displayAuthor("Abolaji Bamidele-Alao")).toBe("Abolaji B.")
    expect(displayAuthor("Madonna")).toBe("Madonna")
  })
})
