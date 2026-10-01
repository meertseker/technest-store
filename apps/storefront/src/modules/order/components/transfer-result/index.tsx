import Link from "next/link"
import { CircleAlert } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import Notice from "@/components/ui/notice"
import { blockLinkClass, h1Class } from "@/lib/typography"

/** Page frame shared by the order transfer pages */
export function TransferShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="content-container max-w-xl py-10 lg:py-14">
      <h1 className={h1Class}>{title}</h1>
      {children}
    </div>
  )
}

/**
 * What happened after accepting or declining. The server's own error text is
 * never shown: it names tokens, which means nothing to a shopper.
 */
export function TransferOutcome({ success, done }: { success: boolean; done: string }) {
  return success ? (
    <>
      <Notice tone="success" className="mt-6">
        {done}
      </Notice>
      <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-6 w-full sm:w-auto" })}>
        Go to the home page
      </Link>
    </>
  ) : (
    <>
      <div role="alert" className="mt-6 flex gap-3 rounded border border-destructive p-4">
        <CircleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-destructive" />
        <p>This link is no longer valid. It may have been used already, or it has expired.</p>
      </div>
      <p className="mt-4">
        <Link href="/contact" className={blockLinkClass}>
          Contact the shop
        </Link>
      </p>
    </>
  )
}
