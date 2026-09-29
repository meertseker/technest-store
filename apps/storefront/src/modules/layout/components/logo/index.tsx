import Link from "next/link"

const wordmark = (
  <span className="whitespace-nowrap text-lg font-extrabold uppercase tracking-tight text-brand lg:text-2xl">
    Tech Nest
  </span>
)

/** fullReload: plain <a>, used on /checkout so leaving it drops the strict CSP */
export default function Logo({ fullReload = false }: { fullReload?: boolean }) {
  const props = {
    href: "/",
    "aria-label": "Tech Nest home",
    className: "inline-flex min-h-11 items-center",
  }
  return fullReload ? <a {...props}>{wordmark}</a> : <Link {...props}>{wordmark}</Link>
}
