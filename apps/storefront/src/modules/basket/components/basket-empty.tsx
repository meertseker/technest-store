import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export default function BasketEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center" data-testid="basket-empty">
      <ShoppingBag aria-hidden className="size-10 text-muted-foreground" />
      <p className="text-lg font-semibold">Your basket is empty</p>
      <p className="max-w-[34ch] text-muted-foreground">
        Find cases, chargers and cables that fit your device.
      </p>
      <Link href="/" className={buttonVariants({ variant: "secondary", size: "md" })}>
        Start shopping
      </Link>
    </div>
  )
}
