export type GoogleReview = {
  id: string
  author: string
  stars: number
  text: string
  relative_date: string
}

/**
 * Fixed rule (docs/specs/design.md 7.1): the newest reviews with at least
 * 60 characters of text. Text is never edited or shortened here.
 */
export function pickFeaturedReviews(reviews: GoogleReview[], count: number) {
  return reviews.filter((r) => r.text.trim().length >= 60).slice(0, count)
}

/** "Anna Kmieciak (Anna K)" -> "Anna K." (privacy: first name + initial) */
export function displayAuthor(author: string) {
  const name = author.replace(/\(.*\)/, "").trim()
  const [first, ...rest] = name.split(/\s+/)
  const last = rest[rest.length - 1]
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}
