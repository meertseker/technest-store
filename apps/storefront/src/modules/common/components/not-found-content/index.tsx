import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

type Props = {
  /** Checkout pages leave with a full page load so their strict CSP isn't carried over */
  fullReload?: boolean
}

const LINKS = [
  { href: "/search", label: "Search all products" },
  { href: "/devices", label: "Find accessories for your device" },
  { href: "/contact", label: "Contact the shop" },
]

/**
 * 404 content shared by every not-found boundary: one h1, 16px text and 44px
 * links to the places people usually want (spec 8 quality gates).
 */
export default function NotFoundContent({ fullReload }: Props) {
  const A = fullReload ? "a" : Link
  return (
    <div className="content-container flex flex-col items-start gap-4 py-12 lg:py-20">
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
        Page not found
      </h1>
      <p className="max-w-[68ch] text-muted-foreground">
        The page you tried to open doesn&apos;t exist or has moved.
      </p>
      <A href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
        Go to the home page
      </A>
      <ul className="flex flex-col gap-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <A href={l.href} className="inline-flex min-h-11 items-center underline underline-offset-4">
              {l.label}
            </A>
          </li>
        ))}
      </ul>
    </div>
  )
}
