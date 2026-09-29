import Link from "next/link"

export default function Logo() {
  return (
    <Link
      href="/"
      aria-label="Tech Nest home"
      className="inline-flex min-h-11 items-center"
    >
      <span className="whitespace-nowrap text-lg font-extrabold uppercase tracking-tight text-brand lg:text-2xl">
        Tech Nest
      </span>
    </Link>
  )
}
