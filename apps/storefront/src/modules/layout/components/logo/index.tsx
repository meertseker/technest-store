import Link from "next/link"

/**
 * Wordmark styled after the sign over the door: bold, uppercase, in the
 * shop's red. Uppercase here is the logo, not a text style.
 */
const wordmark = (
  <span className="font-display whitespace-nowrap text-[22px] font-bold uppercase leading-none tracking-[-0.02em] text-brand lg:text-[26px]">
    Tech Nest
  </span>
)

/** fullReload: plain <a>, used on /checkout so leaving it drops the strict CSP */
export default function Logo({ fullReload = false }: { fullReload?: boolean }) {
  const props = {
    href: "/",
    "aria-label": "Tech Nest home",
    className: "inline-flex min-h-11 items-center rounded",
  }
  return fullReload ? <a {...props}>{wordmark}</a> : <Link {...props}>{wordmark}</Link>
}
