/**
 * Customer-typed text for a subject or preview line: one line, no control
 * characters, at most `max` characters. (React escapes HTML in the body and
 * nodemailer strips line breaks from headers; this keeps subjects readable.)
 */
export function oneLine(value: unknown, max = 60): string {
  const s = String(value ?? "")
    .replace(/[\x00-\x1f\x7f-\x9f]+/g, " ")
    .replace(/\s+/g, " ") // also U+2028/U+2029
    .trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}
