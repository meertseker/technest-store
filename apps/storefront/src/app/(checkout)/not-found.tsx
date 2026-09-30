import { Metadata } from "next"
import NotFoundContent from "@modules/common/components/not-found-content"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

export default function NotFound() {
  return <NotFoundContent fullReload />
}
