import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const variants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded text-base font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-foreground hover:bg-brand-hover",
        secondary:
          "border border-border-strong bg-background text-foreground hover:bg-surface",
        ghost: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        md: "min-h-11 px-4",
        lg: "min-h-12 px-6",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  }
)

/** cva output passed through twMerge so a caller's className wins over defaults */
const buttonVariants = (props?: Parameters<typeof variants>[0]) =>
  cn(variants(props))

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
