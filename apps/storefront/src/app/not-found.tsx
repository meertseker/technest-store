import { Metadata } from "next"
import NotFoundContent from "@modules/common/components/not-found-content"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

/** Unmatched URLs render outside the (main) layout, so this brings its own header and footer */
export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NotFoundContent />
      </main>
      <Footer />
    </>
  )
}
