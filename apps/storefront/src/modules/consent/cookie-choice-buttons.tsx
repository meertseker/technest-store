import { buttonVariants } from "@/components/ui/button"
import { saveConsent } from "@/lib/consent/actions"

/**
 * "Reject" and "Accept" side by side with identical size and style, so
 * rejecting is exactly as easy as accepting (ICO / PECR guidance).
 */
export default function CookieChoiceButtons({ className }: { className?: string }) {
  const button = buttonVariants({ variant: "secondary", size: "md", className: "flex-1 sm:flex-none sm:min-w-[8rem]" })
  return (
    <form action={saveConsent} className={className}>
      <div className="flex gap-3">
        <button type="submit" name="choice" value="rejected" className={button}>
          Reject
        </button>
        <button type="submit" name="choice" value="accepted" className={button}>
          Accept
        </button>
      </div>
    </form>
  )
}
