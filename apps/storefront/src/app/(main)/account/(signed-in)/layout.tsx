import { retrieveCustomer, signout } from "@lib/data/customer"
import AccountNav from "@modules/account/components/account-nav"

/**
 * Signed-in account pages. Each page calls requireCustomer(itsPath) itself,
 * so a signed-out visitor is sent to sign in and brought back to the page
 * they asked for (a layout cannot know the path).
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const customer = await retrieveCustomer().catch(() => null)
  return (
    <div className="content-container py-8 lg:py-12" data-testid="account-page">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
        <div>{customer && <AccountNav signOut={signout} />}</div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
