import { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { h1Class, h2Class } from "@/lib/typography"
import { requireCustomer } from "@lib/data/account"
import ProfileForm from "@modules/account/components/profile-form"

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
}

export default async function ProfilePage() {
  const customer = await requireCustomer("/account/profile")
  return (
    <div className="flex flex-col gap-10">
      <h1 className={h1Class}>Your details</h1>

      <section aria-labelledby="name-phone">
        <h2 id="name-phone" className={h2Class}>
          Name and phone
        </h2>
        <div className="mt-4">
          <ProfileForm
            initial={{ first_name: customer.first_name ?? "", last_name: customer.last_name ?? "", phone: customer.phone ?? "" }}
          />
        </div>
      </section>

      <section aria-labelledby="email-h">
        <h2 id="email-h" className={h2Class}>
          Email address
        </h2>
        <p className="mt-2 break-all font-semibold">{customer.email}</p>
        <p className="mt-1 max-w-[68ch] text-muted-foreground">
          You sign in with this address and we send order emails to it. To change it, call the shop and we will update
          it for you.
        </p>
      </section>

      <section aria-labelledby="password-h">
        <h2 id="password-h" className={h2Class}>
          Password
        </h2>
        <p className="mt-2 max-w-[68ch]">We will email you a link to choose a new password.</p>
        <Link
          href="/account/forgot-password"
          className={buttonVariants({ variant: "secondary", className: "mt-4 w-full sm:w-auto" })}
        >
          Change password
        </Link>
      </section>
    </div>
  )
}
