import { describe, expect, it } from "vitest"
import {
  formatTime,
  getOpenStatus,
  parseHoursLine,
  siteConfig,
} from "./site-config"

describe("parseHoursLine", () => {
  it("parses Google's en-dash format", () => {
    expect(parseHoursLine("Tuesday 9 am–8 pm")).toEqual({
      day: "Tuesday",
      opens: "09:00",
      closes: "20:00",
    })
    expect(parseHoursLine("Sunday 11 am–5 pm")).toEqual({
      day: "Sunday",
      opens: "11:00",
      closes: "17:00",
    })
  })
  it("parses minutes, hyphens and 12 noon/midnight", () => {
    expect(parseHoursLine("Monday 9:30 am-12 pm")).toEqual({
      day: "Monday",
      opens: "09:30",
      closes: "12:00",
    })
    expect(parseHoursLine("Friday 12 am–11:30 pm")).toEqual({
      day: "Friday",
      opens: "00:00",
      closes: "23:30",
    })
  })
  it("treats Closed and unknown text as closed without throwing", () => {
    expect(parseHoursLine("Sunday Closed")).toEqual({
      day: "Sunday",
      opens: null,
      closes: null,
    })
    expect(parseHoursLine("Sunday Hours might differ")).toEqual({
      day: "Sunday",
      opens: null,
      closes: null,
    })
  })
  it("handles Open 24 hours", () => {
    expect(parseHoursLine("Saturday Open 24 hours")).toEqual({
      day: "Saturday",
      opens: "00:00",
      closes: "24:00",
    })
  })
})

describe("siteConfig", () => {
  it("is built from the profile", () => {
    expect(siteConfig.address.postcode).toBe("SE16 3TU")
    expect(siteConfig.phone.e164).toBe("+447775669000")
    expect(siteConfig.hours.map((h) => h.day)[0]).toBe("Monday")
    expect(siteConfig.hours).toHaveLength(7)
    expect(siteConfig.hours.find((h) => h.day === "Sunday")).toEqual({
      day: "Sunday",
      opens: "11:00",
      closes: "17:00",
    })
    expect(siteConfig.rating).toEqual({ value: 5, count: 30 })
  })
})

describe("formatTime", () => {
  it("formats compactly", () => {
    expect(formatTime("09:00")).toBe("9am")
    expect(formatTime("17:30")).toBe("5:30pm")
    expect(formatTime("12:00")).toBe("12pm")
  })
})

describe("getOpenStatus (Europe/London)", () => {
  it("is open at 19:30 London on a BST Monday (18:30 UTC)", () => {
    const s = getOpenStatus(new Date("2026-10-05T18:30:00Z"))
    expect(s.open).toBe(true)
    expect(s.label).toBe("Open now · until 8pm")
  })
  it("is closed at 20:30 London on a BST Monday (19:30 UTC)", () => {
    const s = getOpenStatus(new Date("2026-10-05T19:30:00Z"))
    expect(s.open).toBe(false)
    expect(s.label).toBe("Closed now · opens 9am tomorrow")
  })
  it("uses Sunday hours and GMT after the clocks change", () => {
    const s = getOpenStatus(new Date("2026-11-01T10:30:00Z"))
    expect(s.today.day).toBe("Sunday")
    expect(s.open).toBe(false)
    expect(s.label).toBe("Closed now · opens 11am today")
  })
})
