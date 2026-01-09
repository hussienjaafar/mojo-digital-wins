import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Base Button component - Enterprise-grade styling
 * 
 * Variant mapping:
 * - default: Primary CTA (use sparingly)
 * - secondary: Normal actions
 * - outline: Alternative secondary
 * - ghost: Utility actions (Refresh, Export, Test)
 * - destructive: Dangerous actions (filled red, NEVER yellow)
 * - link: Inline text actions
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-lg text-sm font-medium transition-all duration-200",
    "ring-offset-background focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary - main CTA
        default: [
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
          "shadow-sm hover:shadow-md active:shadow-sm active:translate-y-px",
        ].join(" "),
        
        // Destructive - filled red, NEVER yellow or outline
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90",
          "shadow-sm hover:shadow-md active:shadow-sm active:translate-y-px",
        ].join(" "),
        
        // Outline - secondary with visible border
        outline: [
          "border border-input bg-background",
          "text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
          "active:bg-accent/80",
        ].join(" "),
        
        // Secondary - subtle surface
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80",
          "active:bg-secondary/70",
        ].join(" "),
        
        // Ghost - minimal, for utility actions
        ghost: [
          "text-muted-foreground",
          "hover:bg-accent hover:text-accent-foreground",
          "active:bg-accent/80",
        ].join(" "),
        
        // Link - text-style button
        link: [
          "text-primary underline-offset-4",
          "hover:underline",
          "p-0 h-auto",
        ].join(" "),
      },
      size: {
        // Improved sizing with premium padding
        default: "h-10 px-5 py-2.5",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6",
        xl: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
