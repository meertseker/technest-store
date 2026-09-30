import { permanentRedirect } from "next/navigation"

/** The starter's /cart moved to /basket (spec 10). Query strings (e.g. ?error= from E2's payment return) are kept. */
export default async function Cart(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(await props.searchParams)) {
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, one)
  }
  const qs = params.toString()
  permanentRedirect(`/basket${qs ? `?${qs}` : ""}`)
}
