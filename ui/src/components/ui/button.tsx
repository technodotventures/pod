import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all outline-none cursor-pointer disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-coffee-pink text-white hover:bg-coffee-pink/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-3",
        secondary:
          "bg-surface-3 border border-border text-foreground hover:bg-surface-4",
        ghost:
          "bg-transparent text-foreground hover:bg-surface-3",
        link: "text-coffee-pink underline-offset-4 hover:underline",
        icon:
          "bg-transparent text-muted-foreground hover:bg-surface-3 hover:text-foreground",
      },
      size: {
        default: "h-[34px] px-[18px] rounded-full text-sm",
        sm: "h-7 px-2.5 rounded-full text-xs font-bold",
        lg: "h-10 px-6 rounded-full text-sm",
        icon: "size-[34px] rounded-[10px]",
        "icon-sm": "size-[26px] rounded-[7px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
