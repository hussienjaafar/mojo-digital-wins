import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground font-bold transition-all duration-300",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg hover:shadow-xl transform hover:scale-105 font-bold border-2 border-destructive hover:border-primary-foreground",
        cta: "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground shadow-md hover:shadow-xl font-bold border-2 border-accent hover:border-primary-foreground transition-all duration-300 transform hover:scale-105",
        brutal: "bg-primary text-primary-foreground font-black border-4 border-destructive shadow-[4px_4px_0px_hsl(var(--destructive))] hover:shadow-[6px_6px_0px_hsl(var(--destructive))] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all",
        movement: "bg-gradient-to-r from-secondary to-primary text-primary-foreground font-bold shadow-lg hover:shadow-glow-red transform hover:scale-105 border-2 border-primary-foreground/20",
        // NEW: Claude Console inspired variants
        gradient: "bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] font-semibold",
        glass: "backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 hover:bg-white/20 dark:hover:bg-white/10 shadow-lg hover:shadow-xl",
        smooth: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 hover:shadow-md",
        shine: "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md hover:shadow-lg relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
      },
      size: {
        default: "h-11 px-4 py-2 min-h-[44px]",
        sm: "h-10 rounded-md px-3 min-h-[40px]",
        lg: "h-12 rounded-md px-6 md:px-8 min-h-[48px]",
        xl: "h-14 rounded-lg px-8 md:px-10 text-base min-h-[56px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
