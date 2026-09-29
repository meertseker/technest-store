import Link from "next/link"
import React from "react"

/** Thin wrapper kept for the starter's call sites; the site has no country prefix. */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: unknown
}) => (
  <Link href={href} {...props}>
    {children}
  </Link>
)

export default LocalizedClientLink
